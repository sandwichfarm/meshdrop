import {createFederationConfig} from "./federation-config.js";
import {FederationFipsTransport} from "./federation-fips.js";
import {FederationNostrDiscovery} from "./federation-nostr.js";
import {FederationPollenTransport} from "./federation-pollen.js";

const writeStderr = (...parts) => process.stderr.write(`${parts.join(" ")}\n`);
const errorMessage = error => error?.message || String(error);

export {createFederationConfig};

export default class MeshFederation {

    constructor(config, {fipsClient = null, pollenClient = null} = {}) {
        this.config = config;
        this.fipsClient = fipsClient;
        this.pollenClient = pollenClient;
        this.wsServer = null;
        this.localPeers = new Map();
        this.remoteServers = new Map();
        this.timers = [];
        this.fipsPeerEvents = null;
        this.localFipsBaseUrl = this.config.fips.publicUrl;
        this.pollenTransport = new FederationPollenTransport({
            config,
            pollenClient,
            trace: (...parts) => this._trace(...parts)
        });
        this.fipsTransport = new FederationFipsTransport({
            config,
            fipsClient,
            trace: (...parts) => this._trace(...parts),
            setLocalBaseUrl: baseUrl => { this.localFipsBaseUrl = baseUrl; },
            getLocalBaseUrl: () => this.localFipsBaseUrl,
            discoverPeer: peer => this._discoverFipsPeer(peer),
            removePeer: (peer, disconnect) => this._removeFipsPeer(peer, disconnect),
            removeRemoteServer: (server, disconnect) => this._removeRemoteServer(server, disconnect),
            remoteServers: this.remoteServers
        });
        this.nostrDiscovery = new FederationNostrDiscovery({
            config,
            trace: (...parts) => this._trace(...parts),
            getFipsBaseUrl: () => this.localFipsBaseUrl,
            getPollenIdentity: () => this.pollenTransport.identity(),
            discoverHttpServer: server => this._discoverHttpServer(server),
            connectPollenService: (serverId, serviceName) => this._connectPollenService(serverId, serviceName),
            createPollenInvite: (pubkey, subjectNodeId) => this.pollenTransport.createInvite(subjectNodeId),
            joinPollenInvite: payload => this.pollenTransport.joinInvite(payload.token),
            reportError: (...parts) => writeStderr(...parts)
        });
        this.relaySockets = this.nostrDiscovery.relaySockets;
        this.seenNostrEvents = this.nostrDiscovery.seenEvents;
    }

    attachWsServer(wsServer) {
        this.wsServer = wsServer;
    }

    start() {
        if (!this.config.enabled) return;

        this._trace(
            "start",
            `server=${this.config.serverId}`,
            `fips=${this.config.fips.enabled}`,
            `pollen=${this.config.pollen.enabled}`,
            `nostr=${this.config.nostr.enabled}`,
            `network=${this.config.nostr.networkId}`
        );
        if (this.config.pollen.enabled) {
            this._ensurePollenService().catch(error => {
                writeStderr("Pollen federation service failed", errorMessage(error));
            });
        }
        if ((this.config.fips.enabled || this.config.pollen.enabled) && this.config.nostr.enabled) {
            this._connectNostrRelays();
        }
        this._listenFipsPeerEvents();
        this._poll();
        this.timers.push(setInterval(() => this._poll(), this.config.pollMs));
    }

    stop() {
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];
        this.nostrDiscovery.stop();
        this.fipsTransport.closePeerEvents();
        this.pollenTransport.stop();
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
        return this.fipsTransport.discoverPeers();
    }

    _listenFipsPeerEvents() {
        this.fipsTransport.listenPeerEvents();
        this.fipsPeerEvents = this.fipsTransport.peerEvents;
    }

    async _discoverFipsPeer(peer) {
        return this.fipsTransport.discoverPeerAddress(peer);
    }

    _removeFipsPeer(peer, disconnect = true) {
        return this.fipsTransport.removePeerAddress(peer, disconnect);
    }

    async _poll() {
        await this.discoverFipsPeers().catch(error => writeStderr("FIPS route candidate refresh failed", errorMessage(error)));
        await this._announceFipsNostr().catch(error => writeStderr("FIPS Nostr announcement failed", errorMessage(error)));
        if (this.config.pollen.enabled) {
            await this._ensurePollenService().catch(error => writeStderr("Pollen federation service failed", errorMessage(error)));
            await this._announcePollenNostr().catch(error => writeStderr("Pollen Nostr announcement failed", errorMessage(error)));
        }
    }

    async _discoverHttpServer(server) {
        let response;
        this._trace("http discover", server.transport, server.baseUrl);
        try {
            response = await fetch(`${server.baseUrl}/.well-known/meshdrop-federation`, {
                signal: AbortSignal.timeout(this.config.timeoutMs)
            });
        } catch (error) {
            this._removeRemoteServer(server, true);
            this._trace("http discover failed", server.transport, server.baseUrl, errorMessage(error));
            throw error;
        }
        if (!response.ok) {
            this._trace("http discover rejected", server.transport, server.baseUrl, `status=${response.status}`);
            return;
        }

        const snapshot = await response.json();
        if (!snapshot.serverId || snapshot.serverId === this.config.serverId) {
            this._trace("http discover ignored self-or-empty", server.transport, server.baseUrl);
            return;
        }
        const peers = (snapshot.peers || []).map(peer => ({type: "peer-joined", ...peer}));

        const discovered = {
            ...server,
            serverId: snapshot.serverId,
            peerIds: peers.map(peer => peer.peer?.id).filter(Boolean),
            lastSeen: Date.now()
        };
        this.remoteServers.set(this._serverKey(discovered), discovered);
        this._trace(
            "http discover accepted",
            server.transport,
            `remote=${snapshot.serverId}`,
            `peers=${discovered.peerIds.length}`
        );
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
            await this._connectPollenService(payload.serverId, descriptor.serviceName).catch(() => undefined);
            return this.remoteServers.has(this._serverKey({transport, serverId: payload.serverId}));
        }

        if (descriptor.baseUrl) {
            await this._discoverHttpServer({
                serverId: payload.serverId,
                transport,
                baseUrl: descriptor.baseUrl
            }).catch(() => undefined);
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
            writeStderr("MeshDrop federation relay failed", server.baseUrl, error.message);
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
        return this.pollenTransport.ensureService();
    }

    _connectNostrRelays() {
        return this.nostrDiscovery.connectRelays();
    }

    _nostrDiscoveryFilters() {
        return this.nostrDiscovery.discoveryFilters();
    }

    async _announcePollenNostr(socket = null) {
        return this.nostrDiscovery.announcePollen(socket);
    }

    async _announceFipsNostr(socket = null) {
        return this.nostrDiscovery.announceFips(socket);
    }

    async _onNostrRelayMessage(rawMessage) {
        return this.nostrDiscovery.onRelayMessage(rawMessage);
    }

    _isNostrDiscoveryEventForThisNetwork(event) {
        return this.nostrDiscovery._isEventForThisNetwork(event);
    }

    async _connectPollenService(serverId, serviceName) {
        const baseUrl = await this.pollenTransport.connectService(serverId, serviceName);
        await this._discoverHttpServer({
            serverId,
            transport: "pollen",
            baseUrl
        });
    }

    _runPln(args) {
        return this.pollenTransport._runPln(args);
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

    _trace(...parts) {
        if (!this.config.trace) return;
        writeStderr("[meshdrop:federation]", ...parts);
    }
}
