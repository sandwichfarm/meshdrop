import net from "net";
import {
    DEFAULT_NPUB_DISCOVERY_NETWORK_ID,
    createNpubDiscoveryNetwork,
    parseNostrPubkeys,
    pubkeyFromSecret
} from "./npub-network.js";

export const DEFAULT_FIPS_CONTROL_HOST = "127.0.0.1";
export const DEFAULT_FIPS_CONTROL_PORT = "21210";

export function defaultFipsSocketPath() {
    return DEFAULT_FIPS_CONTROL_PORT;
}

export function createFipsConfig(env = process.env) {
    const enabled = env.FIPS_DISCOVERY !== "false" || !!env.FIPS_CONTROL_SOCKET;
    const network = createNpubDiscoveryNetwork({
        localPubkey: pubkeyFromSecret(env.MESHDROP_NOSTR_SECRET_KEY),
        peerPubkeys: parseNostrPubkeys(env.MESHDROP_DISCOVERY_NPUBS || env.MESHDROP_NPUBS || "")
    });

    return {
        enabled,
        controlSocket: env.FIPS_CONTROL_SOCKET || defaultFipsSocketPath(),
        controlHost: env.FIPS_CONTROL_HOST || DEFAULT_FIPS_CONTROL_HOST,
        room: network.id || DEFAULT_NPUB_DISCOVERY_NETWORK_ID,
        timeoutMs: parseInt(env.FIPS_CONTROL_TIMEOUT_MS, 10) || 1000,
        eventCommand: env.FIPS_EVENT_COMMAND || "events"
    };
}

export default class FipsControlClient {

    constructor(config) {
        this.config = config;
    }

    async status() {
        if (!this.config.enabled) {
            return {
                enabled: false,
                room: this.config.room,
                available: false,
                peers: []
            };
        }

        try {
            const [status, peers] = await Promise.all([
                this.request("show_status"),
                this.request("show_peers")
            ]);

            return {
                enabled: true,
                room: this.config.room,
                available: true,
                npub: status.npub,
                ipv6Addr: status.ipv6_addr,
                peerCount: status.peer_count,
                meshSize: status.estimated_mesh_size,
                peers: this.normalizePeers(peers.peers || [])
            };
        }
        catch (error) {
            return {
                enabled: true,
                room: this.config.room,
                available: false,
                error: error.message,
                peers: []
            };
        }
    }

    normalizePeers(peers) {
        return peers.map(peer => ({
            npub: peer.npub,
            displayName: peer.display_name,
            ipv6Addr: peer.ipv6_addr,
            connectivity: peer.connectivity,
            transportType: peer.transport_type,
            transportAddr: peer.transport_addr,
            direction: peer.direction,
            treeDepth: peer.tree_depth
        }));
    }

    async savePeers(peers) {
        if (!this.config.enabled) throw new Error("FIPS discovery is disabled");

        const normalizedPeers = this.normalizePeerSettings(peers);
        const connections = [];
        for (const peer of normalizedPeers) {
            for (const address of peer.addresses) {
                connections.push(await this.request("connect", {
                    npub: peer.npub,
                    address: address.addr,
                    transport: address.transport
                }));
            }
        }

        const restart = await this.restartServer();
        return {peers: normalizedPeers, connections, restart};
    }

    normalizePeerSettings(peers) {
        if (!Array.isArray(peers)) throw new Error("FIPS peers must be an array");
        if (peers.length > 32) throw new Error("FIPS peer list is too large");

        return peers
            .map(peer => this.normalizePeerSetting(peer))
            .filter(peer => peer.npub && peer.addresses.length);
    }

    normalizePeerSetting(peer) {
        const addresses = Array.isArray(peer?.addresses) ? peer.addresses : [{
            transport: peer?.transport || peer?.transportType,
            addr: peer?.address || peer?.transportAddr
        }];

        return {
            npub: this.cleanString(peer?.npub || peer?.peer, 120),
            alias: this.cleanString(peer?.alias || peer?.displayName, 80),
            addresses: addresses
                .map(address => ({
                    transport: this.cleanTransport(address?.transport || "udp"),
                    addr: this.cleanString(address?.addr || address?.address, 160)
                }))
                .filter(address => address.addr)
        };
    }

    async restartServer() {
        try {
            await this.request("restart");
            return {available: true};
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    listenPeerEvents(onEvent) {
        if (!this.config.enabled) return null;

        const socket = this.connect();
        let response = "";
        let active = true;
        const close = () => {
            active = false;
            socket.destroy();
        };

        socket.on("connect", () => {
            socket.write(`${JSON.stringify({
                command: this.config.eventCommand,
                params: {topics: ["peer"], child_objects: true}
            })}\n`);
        });
        socket.on("data", chunk => {
            response += chunk.toString("utf8");
            const lines = response.split("\n");
            response = lines.pop() || "";

            for (const line of lines) {
                if (!line.trim()) continue;
                const event = this.parsePeerEvent(line);
                if (event) onEvent(event);
            }
        });
        socket.on("error", () => {
            active = false;
        });
        socket.on("close", () => {
            active = false;
        });

        return {
            close,
            get active() {
                return active;
            }
        };
    }

    parsePeerEvent(line) {
        let payload;
        try {
            payload = JSON.parse(line);
        } catch {
            return null;
        }

        if (payload.status === "error") return null;
        const data = payload.data || payload.event || payload;
        const type = String(data.type || data.event || data.kind || "").toLowerCase();
        const peer = data.peer || data.peer_info || data;
        const normalizedPeer = this.normalizePeers([peer])[0];
        if (!normalizedPeer?.ipv6Addr) return null;

        const removed = /lost|left|down|removed|disconnect|expired/.test(type);
        return {
            type: removed ? "peer-left" : "peer-joined",
            peer: normalizedPeer,
            raw: payload
        };
    }

    cleanTransport(value) {
        const transport = this.cleanString(value, 20).toLowerCase();
        return ["udp", "tcp", "tor", "ethernet"].includes(transport) ? transport : "udp";
    }

    cleanString(value, maxLength) {
        return typeof value === "string"
            ? value.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, maxLength)
            : "";
    }

    request(command, params) {
        return new Promise((resolve, reject) => {
            const socket = this.connect();
            let response = "";
            const timer = setTimeout(() => {
                socket.destroy();
                reject(new Error("FIPS control socket timeout"));
            }, this.config.timeoutMs);

            socket.on("connect", () => {
                socket.write(`${JSON.stringify({command, params})}\n`);
            });
            socket.on("data", chunk => {
                response += chunk.toString("utf8");
                if (response.includes("\n")) socket.end();
            });
            socket.on("error", error => {
                clearTimeout(timer);
                reject(error);
            });
            socket.on("close", () => {
                clearTimeout(timer);
                if (!response) {
                    reject(new Error("FIPS control socket closed without response"));
                    return;
                }

                try {
                    const payload = JSON.parse(response.split("\n")[0]);
                    if (payload.status === "ok") {
                        resolve(payload.data || {});
                    }
                    else {
                        reject(new Error(payload.message || "FIPS control request failed"));
                    }
                }
                catch (error) {
                    reject(new Error(`Invalid FIPS control response: ${error.message}`));
                }
            });
        });
    }

    connect() {
        if (/^\d+$/.test(this.config.controlSocket)) {
            return net.createConnection({host: this.config.controlHost, port: Number(this.config.controlSocket)});
        }

        return net.createConnection({path: this.config.controlSocket});
    }
}
