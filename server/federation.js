import crypto from "crypto";
import fs from "fs";
import net from "net";
import path from "path";
import {spawn} from "child_process";
import {finalizeEvent, generateSecretKey, getPublicKey, utils} from "nostr-tools";
import {WebSocket} from "ws";

const FEDERATION_KIND = 25051;
const DEFAULT_FIPS_ROOM = "meshdrop-fips";
const DEFAULT_POLLEN_ROOM = "meshdrop-pollen";
const SERVICE_PREFIX = "meshdrop-fed";

export function createFederationConfig(env = process.env) {
    const enabled = env.MESHDROP_FEDERATION !== "false";
    const serverId = env.MESHDROP_SERVER_ID || loadOrCreateServerId(env.PLN_DIR || "/var/lib/meshdrop/pln");

    return {
        enabled,
        serverId,
        port: Number.parseInt(env.PORT || "3000", 10) || 3000,
        basePath: env.MESHDROP_FEDERATION_BASE_PATH || "",
        pollMs: Number.parseInt(env.MESHDROP_FEDERATION_POLL_MS || "", 10) || 15000,
        fips: {
            enabled: enabled && env.FIPS_DISCOVERY !== "false",
            room: env.FIPS_ROOM || DEFAULT_FIPS_ROOM,
            port: Number.parseInt(env.FIPS_FEDERATION_PORT || env.PORT || "3000", 10) || 3000,
            publicUrl: env.FIPS_FEDERATION_URL || env.MESHDROP_FEDERATION_PUBLIC_URL || ""
        },
        pollen: {
            enabled: enabled && env.POLLEN_TRANSFER !== "false",
            room: env.POLLEN_ROOM || DEFAULT_POLLEN_ROOM,
            command: env.PLN_BIN || "pln",
            dir: env.PLN_DIR || "/var/lib/meshdrop/pln",
            serviceName: env.POLLEN_FEDERATION_SERVICE || `${SERVICE_PREFIX}-${serverId.slice(0, 16)}`
        },
        nostr: {
            enabled: env.POLLEN_NOSTR_BOOTSTRAP !== "false",
            relays: (env.NOSTR_RELAYS || "wss://bucket.coracle.social")
                .split(",")
                .map(relay => relay.trim())
                .filter(Boolean),
            room: env.POLLEN_NOSTR_ROOM || env.NOSTR_ROOM || "meshdrop",
            secretKey: loadOrCreateNostrKey(env.MESHDROP_NOSTR_SECRET_KEY, env.PLN_DIR || "/var/lib/meshdrop/pln")
        },
        timeoutMs: Number.parseInt(env.MESHDROP_FEDERATION_TIMEOUT_MS || "", 10) || 2500
    };
}

export default class MeshFederation {

    constructor(config, {fipsClient = null, pollenClient = null} = {}) {
        this.config = config;
        this.fipsClient = fipsClient;
        this.pollenClient = pollenClient;
        this.wsServer = null;
        this.localPeers = new Map();
        this.remoteServers = new Map();
        this.timers = [];
        this.relaySockets = new Map();
        this.seenNostrEvents = new Set();
        this.fipsPeerEvents = null;
        this.localFipsBaseUrl = this.config.fips.publicUrl;
    }

    attachWsServer(wsServer) {
        this.wsServer = wsServer;
    }

    start() {
        if (!this.config.enabled) return;

        if (this.config.pollen.enabled) {
            this._ensurePollenService();
        }
        if (this.config.pollen.enabled && this.config.nostr.enabled) {
            this._connectNostrRelays();
        }
        this._listenFipsPeerEvents();
        this._poll();
        this.timers.push(setInterval(() => this._poll(), this.config.pollMs));
    }

    stop() {
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];
        for (const socket of this.relaySockets.values()) socket.close();
        this.relaySockets.clear();
        this.fipsPeerEvents?.close();
        this.fipsPeerEvents = null;
    }

    localPeerJoined(roomType, roomId, peerInfo) {
        if (!this._isFederatedRoom(roomType)) return;

        const key = this._roomKey(roomType, roomId);
        if (!this.localPeers.has(key)) this.localPeers.set(key, new Map());
        this.localPeers.get(key).set(peerInfo.id, peerInfo);
        this._broadcast({type: "peer-joined", roomType, roomId, peer: peerInfo}, roomType);
    }

    localPeerLeft(roomType, roomId, peerId) {
        if (!this._isFederatedRoom(roomType)) return;

        const key = this._roomKey(roomType, roomId);
        this.localPeers.get(key)?.delete(peerId);
        this._broadcast({type: "peer-left", roomType, roomId, peerId, disconnect: true}, roomType);
    }

    sendSignal(target, sender, message) {
        const server = this.remoteServers.get(this._serverKey(target)) || target;
        const event = {
            type: "signal",
            roomType: message.roomType,
            roomId: message.roomId,
            to: message.to,
            sender,
            sdp: message.sdp,
            ice: message.ice,
            sessionId: message.sessionId
        };
        return this._postEvents(server, [event]);
    }

    snapshot() {
        const peers = [];
        for (const [key, roomPeers] of this.localPeers.entries()) {
            const {roomType, roomId} = this._parseRoomKey(key);
            for (const peer of roomPeers.values()) {
                peers.push({roomType, roomId, peer});
            }
        }

        return {
            serverId: this.config.serverId,
            kind: "meshdrop-federation",
            transports: {
                fips: this.config.fips.enabled,
                pollen: this.config.pollen.enabled
            },
            pollen: this.config.pollen.enabled
                ? {serviceName: this.config.pollen.serviceName, room: this.config.pollen.room}
                : null,
            peers
        };
    }

    async receiveEvents(payload = {}) {
        if (!payload.serverId || payload.serverId === this.config.serverId) return {accepted: 0};

        const transport = payload.transport || "federation";
        if (!this.remoteServers.has(this._serverKey({transport, serverId: payload.serverId}))) {
            const verified = await this._verifyAndRegisterSender(payload, transport);
            if (!verified) return {accepted: 0, error: "unknown federation server"};
        }

        const events = Array.isArray(payload.events) ? payload.events : [];
        for (const event of events) {
            const hydrated = {
                ...event,
                serverId: payload.serverId,
                transport: event.transport || transport
            };
            this._dispatchEvent(hydrated);
        }

        return {accepted: events.length};
    }

    async discoverFipsPeers() {
        if (!this.config.fips.enabled || !this.fipsClient) return;

        const status = await this.fipsClient.status();
        if (!status.available) return;
        if (!this.config.fips.publicUrl && status.ipv6Addr) {
            this.localFipsBaseUrl = `http://[${status.ipv6Addr}]:${this.config.fips.port}${this.config.basePath}`;
        }

        const peers = Array.isArray(status.peers) ? status.peers : [];
        await Promise.all(peers
            .filter(peer => peer.ipv6Addr)
            .map(peer => this._discoverFipsPeer(peer)));
    }

    _listenFipsPeerEvents() {
        if (!this.config.fips.enabled || !this.fipsClient?.listenPeerEvents || this.fipsPeerEvents?.active) return;

        this.fipsPeerEvents = this.fipsClient.listenPeerEvents(event => {
            if (event.type === "peer-left") {
                this._removeFipsPeer(event.peer, true);
                return;
            }

            this._discoverFipsPeer(event.peer).catch(error => {
                console.warn("FIPS federation discovery event failed", error.message);
            });
        });
    }

    async _discoverFipsPeer(peer) {
        if (!peer?.ipv6Addr) return;

        await this._discoverHttpServer({
            serverId: `fips:${peer.ipv6Addr}`,
            transport: "fips",
            peer,
            baseUrl: `http://[${peer.ipv6Addr}]:${this.config.fips.port}${this.config.basePath}`
        });
    }

    _removeFipsPeer(peer, disconnect = true) {
        if (!peer?.ipv6Addr) return;

        const needle = `http://[${peer.ipv6Addr}]:`;
        for (const server of this.remoteServers.values()) {
            if (server.transport === "fips" && server.baseUrl.startsWith(needle)) {
                this._removeRemoteServer(server, disconnect);
            }
        }
    }

    async _poll() {
        await this.discoverFipsPeers().catch(error => console.warn("FIPS federation discovery failed", error.message));
        if (this.config.pollen.enabled) {
            await this._ensurePollenService().catch(error => console.warn("Pollen federation service failed", error.message));
            await this._announcePollenNostr().catch(error => console.warn("Pollen Nostr announcement failed", error.message));
        }
    }

    async _discoverHttpServer(server) {
        let response;
        try {
            response = await fetch(`${server.baseUrl}/.well-known/meshdrop-federation`, {
                signal: AbortSignal.timeout(this.config.timeoutMs)
            });
        } catch (error) {
            this._removeRemoteServer(server, true);
            throw error;
        }
        if (!response.ok) return;

        const snapshot = await response.json();
        if (!snapshot.serverId || snapshot.serverId === this.config.serverId) return;
        const peers = (snapshot.peers || []).map(peer => ({type: "peer-joined", ...peer}));

        const discovered = {
            ...server,
            serverId: snapshot.serverId,
            peerIds: peers.map(peer => peer.peer?.id).filter(Boolean),
            lastSeen: Date.now()
        };
        this.remoteServers.set(this._serverKey(discovered), discovered);
        await this.receiveEvents({
            serverId: snapshot.serverId,
            transport: server.transport,
            events: peers
        });
    }

    async _verifyAndRegisterSender(payload, transport) {
        const descriptor = payload.server || {};
        if (descriptor.serverId && descriptor.serverId !== payload.serverId) return false;
        if (descriptor.transport && descriptor.transport !== transport) return false;

        if (transport === "pollen" && descriptor.serviceName) {
            await this._connectPollenService(payload.serverId, descriptor.serviceName).catch(() => {});
            return this.remoteServers.has(this._serverKey({transport, serverId: payload.serverId}));
        }

        if (descriptor.baseUrl) {
            await this._discoverHttpServer({
                serverId: payload.serverId,
                transport,
                baseUrl: descriptor.baseUrl
            }).catch(() => {});
            return this.remoteServers.has(this._serverKey({transport, serverId: payload.serverId}));
        }

        return false;
    }

    _removeRemoteServer(server, disconnect = true) {
        const stored = this.remoteServers.get(this._serverKey(server)) || this._findRemoteServer(server);
        if (!stored) return;

        this.remoteServers.delete(this._serverKey(stored));
        for (const peerId of stored.peerIds || []) {
            this._dispatchEvent({
                type: "peer-left",
                transport: stored.transport,
                serverId: stored.serverId,
                roomType: stored.transport,
                roomId: this.config[stored.transport]?.room,
                peerId,
                disconnect
            });
        }
    }

    _findRemoteServer(server) {
        return [...this.remoteServers.values()].find(candidate =>
            candidate.transport === server.transport
            && (candidate.serverId === server.serverId || candidate.baseUrl === server.baseUrl)
        );
    }

    async _broadcast(event, roomType) {
        const targets = [...this.remoteServers.values()].filter(server => server.transport === roomType);
        await Promise.all(targets.map(server => this._postEvents(server, [event])));
    }

    async _postEvents(server, events) {
        if (!server?.baseUrl) return;

        await fetch(`${server.baseUrl}/federation/events`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                serverId: this.config.serverId,
                transport: server.transport,
                server: this._localServerDescriptor(server.transport),
                events
            }),
            signal: AbortSignal.timeout(this.config.timeoutMs)
        }).catch(error => {
            console.warn("MeshDrop federation relay failed", server.baseUrl, error.message);
        });
    }

    _localServerDescriptor(transport) {
        const descriptor = {
            serverId: this.config.serverId,
            transport
        };

        if (transport === "pollen") {
            descriptor.serviceName = this.config.pollen.serviceName;
        }
        else if (transport === "fips" && this.localFipsBaseUrl) {
            descriptor.baseUrl = this.localFipsBaseUrl;
        }

        return descriptor;
    }

    _dispatchEvent(event) {
        if (!this.wsServer || !this._isFederatedRoom(event.roomType)) return;

        if (event.type === "peer-joined" && event.peer?.id) {
            this.wsServer._onFederationPeerJoined(event);
        }
        else if (event.type === "peer-left" && event.peerId) {
            this.wsServer._onFederationPeerLeft(event);
        }
        else if (event.type === "signal" && event.to && event.sender?.id) {
            this.wsServer._onFederationSignal(event);
        }
    }

    async _ensurePollenService() {
        if (!this.config.pollen.enabled) return;

        const status = this.pollenClient ? await this.pollenClient.status() : {available: true};
        if (!status.available) return;

        const result = await this._runPln(["serve", String(this.config.port), this.config.pollen.serviceName]);
        if (result.code !== 0 && !/already|exists|registered/i.test(`${result.stderr}\n${result.stdout}`)) {
            throw new Error(result.stderr || result.error || "pln serve failed");
        }
    }

    _connectNostrRelays() {
        for (const relay of this.config.nostr.relays) {
            if (this.relaySockets.has(relay)) continue;

            const socket = new WebSocket(relay);
            socket.onopen = () => {
                socket.send(JSON.stringify([
                    "REQ",
                    `meshdrop-fed-${this.config.serverId}`,
                    {kinds: [FEDERATION_KIND], "#r": [this.config.nostr.room]}
                ]));
                this._announcePollenNostr(socket).catch(() => {});
            };
            socket.onmessage = event => this._onNostrRelayMessage(event.data);
            socket.onerror = error => console.warn("Pollen Nostr relay error", relay, error.message);
            socket.onclose = () => this.relaySockets.delete(relay);
            this.relaySockets.set(relay, socket);
        }
    }

    async _announcePollenNostr(socket = null) {
        if (!this.config.nostr.enabled || !this.config.pollen.enabled) return;

        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", "pollen-federation"],
                ["r", this.config.nostr.room],
                ["server", this.config.serverId],
                ["service", this.config.pollen.serviceName],
                ["room", this.config.pollen.room]
            ],
            content: ""
        }, this.config.nostr.secretKey);

        const message = JSON.stringify(["EVENT", event]);
        if (socket) {
            if (socket.readyState === WebSocket.OPEN) socket.send(message);
            return;
        }

        for (const relaySocket of this.relaySockets.values()) {
            if (relaySocket.readyState === WebSocket.OPEN) relaySocket.send(message);
        }
    }

    async _onNostrRelayMessage(rawMessage) {
        let message;
        try {
            message = JSON.parse(rawMessage);
        } catch {
            return;
        }

        if (message[0] !== "EVENT") return;
        const event = message[2];
        if (!event?.id || this.seenNostrEvents.has(event.id)) return;
        this.seenNostrEvents.add(event.id);

        if (event.pubkey === getPublicKey(this.config.nostr.secretKey)) return;
        if (this._tag(event, "type") !== "pollen-federation") return;
        if (this._tag(event, "r") !== this.config.nostr.room) return;

        const serverId = this._tag(event, "server");
        const serviceName = this._tag(event, "service");
        if (!serverId || serverId === this.config.serverId || !serviceName) return;

        await this._connectPollenService(serverId, serviceName).catch(error => {
            console.warn("Pollen federation connect failed", serviceName, error.message);
        });
    }

    async _connectPollenService(serverId, serviceName) {
        const localPort = await findFreePort();
        const result = await this._runPln(["connect", serviceName, String(localPort)]);
        if (result.code !== 0) throw new Error(result.stderr || result.error || "pln connect failed");

        await this._discoverHttpServer({
            serverId,
            transport: "pollen",
            baseUrl: `http://127.0.0.1:${localPort}${this.config.basePath}`
        });
    }

    _runPln(args) {
        const child = spawn(this.config.pollen.command, args, {
            env: {...process.env, PLN_DIR: this.config.pollen.dir},
            stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";
        let error = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", chunk => { stdout += chunk; });
        child.stderr.on("data", chunk => { stderr += chunk; });
        child.on("error", err => { error = err.message; });

        return new Promise(resolve => {
            child.on("close", code => resolve({code, stdout, stderr: stderr.trim(), error}));
        });
    }

    _tag(event, name) {
        return event.tags?.find(tag => tag[0] === name)?.[1] || "";
    }

    _isFederatedRoom(roomType) {
        return roomType === "fips" || roomType === "pollen";
    }

    _roomKey(roomType, roomId) {
        return `${roomType}\n${roomId}`;
    }

    _parseRoomKey(key) {
        const [roomType, roomId] = key.split("\n");
        return {roomType, roomId};
    }

    _serverKey(server) {
        return `${server.transport}:${server.serverId}`;
    }
}

function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}

function loadOrCreateServerId(dir) {
    return loadOrCreateFile(path.join(dir, "meshdrop-server-id"), () => crypto.randomUUID());
}

function loadOrCreateNostrKey(envKey, dir) {
    if (envKey) {
        return utils.hexToBytes(envKey);
    }

    const hex = loadOrCreateFile(path.join(dir, "meshdrop-nostr-secret"), () => utils.bytesToHex(generateSecretKey()));
    return utils.hexToBytes(hex);
}

function loadOrCreateFile(filePath, createValue) {
    try {
        return fs.readFileSync(filePath, "utf8").trim();
    } catch {
        const value = createValue();
        try {
            fs.mkdirSync(path.dirname(filePath), {recursive: true, mode: 0o700});
            fs.writeFileSync(filePath, `${value}\n`, {mode: 0o600});
        } catch {
            return value;
        }
        return value;
    }
}
