const noop = () => undefined;

export class FederationFipsTransport {

    constructor({
        config,
        fipsClient = null,
        trace = noop,
        setLocalBaseUrl = noop,
        getLocalBaseUrl = () => "",
        discoverPeer = noop,
        removePeer = noop,
        removeRemoteServer = noop,
        remoteServers
    }) {
        this.config = config;
        this.fipsClient = fipsClient;
        this.trace = trace;
        this.setLocalBaseUrl = setLocalBaseUrl;
        this.getLocalBaseUrl = getLocalBaseUrl;
        this.discoverPeer = discoverPeer;
        this.removePeer = removePeer;
        this.removeRemoteServer = removeRemoteServer;
        this.remoteServers = remoteServers;
        this.peerEvents = null;
    }

    async discoverPeers() {
        if (!this.config.fips.enabled || !this.fipsClient) return;

        const status = await this.fipsClient.status();
        if (!status.available) {
            this.trace("fips status unavailable", status.error || "no status error");
            return;
        }
        if (!this.config.fips.publicUrl && status.ipv6Addr) {
            this.setLocalBaseUrl(`http://[${status.ipv6Addr}]:${this.config.fips.port}${this.config.basePath}`);
        }

        const peers = Array.isArray(status.peers) ? status.peers : [];
        this.trace(
            "fips status",
            `local=${status.ipv6Addr || "unknown"}`,
            `peerCount=${peers.length}`,
            `baseUrl=${this.getLocalBaseUrl() || "none"}`
        );
        await Promise.all(peers
            .filter(peer => peer.ipv6Addr)
            .map(peer => this.discoverPeer(peer).catch(error => {
                this.trace(
                    "fips discover skipped",
                    peer.displayName || peer.npub || peer.ipv6Addr,
                    error?.message || String(error)
                );
            })));
    }

    listenPeerEvents() {
        if (!this.config.fips.enabled || !this.fipsClient?.listenPeerEvents || this.peerEvents?.active) return;

        this.peerEvents = this.fipsClient.listenPeerEvents(event => {
            this.trace(
                "fips event",
                event.type,
                event.peer?.ipv6Addr || event.peer?.npub || "unknown-peer"
            );
            if (event.type === "peer-left") {
                this.removePeer(event.peer, true);
                return;
            }

            this.discoverPeer(event.peer).catch(error => {
                this.trace(
                    "fips event discover skipped",
                    event.peer?.displayName || event.peer?.npub || event.peer?.ipv6Addr || "unknown-peer",
                    error?.message || String(error)
                );
            });
        });
    }

    closePeerEvents() {
        this.peerEvents?.close();
        this.peerEvents = null;
    }

    async discoverPeerAddress(peer) {
        if (!peer?.ipv6Addr) return;

        this.trace(
            "fips route candidate",
            peer.displayName || peer.npub || "peer",
            peer.ipv6Addr,
            peer.transportType || "unknown-transport",
            peer.transportAddr || "unknown-address"
        );
    }

    removePeerAddress(peer, disconnect = true) {
        if (!peer?.ipv6Addr) return;

        const needle = `http://[${peer.ipv6Addr}]:`;
        for (const server of this.remoteServers.values()) {
            if (server.transport === "fips" && server.baseUrl.startsWith(needle)) {
                this.removeRemoteServer(server, disconnect);
            }
        }
    }
}
