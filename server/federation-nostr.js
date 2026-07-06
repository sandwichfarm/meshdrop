import {finalizeEvent, getPublicKey, nip44} from "nostr-tools";
import {WebSocket} from "ws";

export const FEDERATION_KIND = 20385;
export const FIPS_FEDERATION_PROTOCOL = "meshdrop-fips-nostr-discovery";
export const POLLEN_FEDERATION_PROTOCOL = "meshdrop-pollen-nostr-discovery";

const DISCOVERY_FAILURE_BACKOFF_MS = 60_000;
const errorMessage = error => error?.message || String(error);
const noop = () => undefined;

export class FederationNostrDiscovery {

    constructor({
        config,
        trace = noop,
        getFipsBaseUrl = () => "",
        getPollenIdentity = async () => ({}),
        discoverHttpServer,
        connectPollenService,
        createPollenInvite = async () => "",
        joinPollenInvite = async () => false,
        reportError = noop
    }) {
        this.config = config;
        this.trace = trace;
        this.getFipsBaseUrl = getFipsBaseUrl;
        this.getPollenIdentity = getPollenIdentity;
        this.discoverHttpServer = discoverHttpServer;
        this.connectPollenService = connectPollenService;
        this.createPollenInvite = createPollenInvite;
        this.joinPollenInvite = joinPollenInvite;
        this.reportError = reportError;
        this.relaySockets = new Map();
        this.seenEvents = new Set();
        this.failureBackoff = new Map();
    }

    stop() {
        for (const socket of this.relaySockets.values()) socket.close();
        this.relaySockets.clear();
    }

    connectRelays() {
        for (const relay of this.config.nostr.relays) {
            if (this.relaySockets.has(relay)) continue;

            this.trace("nostr relay connect", relay);
            const socket = new WebSocket(relay);
            socket.onopen = () => {
                const filters = this.discoveryFilters();
                this.trace(
                    "trusted npub set loaded",
                    `mode=${this.config.nostr.discoveryMode || "wot"}`,
                    `count=${this.config.nostr.recipientPubkeys.length}`,
                    `sample=${this.config.nostr.recipientPubkeys.slice(0, 3).map(pubkey => pubkey.slice(0, 8)).join(",") || "none"}`
                );
                this.trace("nostr relay open", relay, `filters=${filters.length}`);
                this.trace("nostr discovery subscription filters", JSON.stringify(filters.map(filter => this._filterSummary(filter))));
                if (filters.length) {
                    socket.send(JSON.stringify(["REQ", `meshdrop-fed-${this.config.serverId}`, ...filters]));
                }
                else {
                    this.trace("nostr discovery subscription skipped", "trusted-set-empty");
                }
                this.announceFips(socket).catch(noop);
                this.announcePollen(socket).catch(noop);
            };
            socket.onmessage = event => this.onRelayMessage(event.data);
            socket.onerror = error => this.reportError("MeshDrop federation Nostr relay error", relay, errorMessage(error));
            socket.onclose = () => {
                this.trace("nostr relay closed", relay);
                this.relaySockets.delete(relay);
            };
            this.relaySockets.set(relay, socket);
        }
    }

    discoveryFilters() {
        const filters = [];
        const trusted = this.config.nostr.recipientPubkeys || [];
        for (let index = 0; index < trusted.length; index += 50) {
            filters.push({
                kinds: [FEDERATION_KIND],
                authors: trusted.slice(index, index + 50)
            });
        }
        if (this.config.nostr.pubkey && trusted.length) {
            filters.push({
                kinds: [FEDERATION_KIND],
                "#p": [this.config.nostr.pubkey]
            });
        }
        if (this._usesPublicNetwork()) {
            filters.push({
                kinds: [FEDERATION_KIND],
                "#d": [this.config.nostr.networkId]
            });
        }
        return filters;
    }

    async announcePollen(socket = null) {
        if (!this.config.nostr.enabled || !this.config.pollen.enabled) return;
        if (!this._canAdvertise()) {
            this.trace("pollen nostr announce skipped", "no-trusted-or-public-discovery");
            return;
        }

        const identity = await this.getPollenIdentity();
        if (identity.needsInvite) {
            return this._announcePollenJoinRequest(identity, socket);
        }
        if (this.config.pollen.clusterBootstrap && !identity.hasMembership) return;

        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ...this._baseDiscoveryTags("pollen-federation", POLLEN_FEDERATION_PROTOCOL),
                ["service", this.config.pollen.serviceName],
                ["room", this.config.pollen.room],
                ["capability", "meshdrop-pollen-service"],
                ...this._pollenIdentityTags(identity)
            ],
            content: ""
        }, this.config.nostr.secretKey);

        this._publishEvent("pollen nostr announce", event, socket, this.config.pollen.serviceName);
    }

    async announceFips(socket = null) {
        const baseUrl = this.getFipsBaseUrl();
        if (!this.config.nostr.enabled || !this.config.fips.enabled || !baseUrl) return;
        if (!this._canAdvertise()) {
            this.trace("fips nostr announce skipped", "no-trusted-or-public-discovery");
            return;
        }

        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ...this._baseDiscoveryTags("fips-federation", FIPS_FEDERATION_PROTOCOL),
                ["base", baseUrl],
                ["capability", "meshdrop-http"],
                ["room", this.config.fips.room]
            ],
            content: ""
        }, this.config.nostr.secretKey);

        this._publishEvent("fips nostr announce", event, socket, baseUrl);
    }

    async onRelayMessage(rawMessage) {
        let message;
        try {
            message = JSON.parse(rawMessage);
        } catch {
            return;
        }

        if (message[0] !== "EVENT") return;
        const event = message[2];
        if (!event?.id) return;
        if (this.seenEvents.has(event.id)) {
            this.trace("nostr discovery event", "accepted=false", "reason=duplicate", `pubkey=${event.pubkey?.slice(0, 8) || "unknown"}`);
            return;
        }
        this.seenEvents.add(event.id);

        const decision = this._eventDecision(event);
        this.trace(
            "nostr discovery event",
            `accepted=${decision.accepted}`,
            `reason=${decision.reason}`,
            `type=${this._tag(event, "type") || "unknown"}`,
            `pubkey=${event.pubkey?.slice(0, 8) || "unknown"}`
        );
        if (!decision.accepted) return;

        const type = this._tag(event, "type");
        if (type === "pollen-join-request") {
            await this._handlePollenJoinRequest(event);
            return;
        }
        if (type === "pollen-invite") {
            await this._handlePollenInvite(event);
            return;
        }
        if (type !== "pollen-federation" && type !== "fips-federation") return;

        const serverId = this._tag(event, "server");
        if (!serverId || serverId === this.config.serverId) return;

        if (type === "fips-federation") {
            const baseUrl = this._tag(event, "base") || this._tag(event, "url");
            if (!baseUrl) return;
            if (this._isFailureSuppressed("fips", baseUrl)) {
                this.trace("fips nostr suppressed", baseUrl);
                return;
            }

            this.trace("fips nostr event", `server=${serverId}`, `baseUrl=${baseUrl}`, `pubkey=${event.pubkey}`);
            await this.discoverHttpServer({serverId, transport: "fips", baseUrl}).catch(error => {
                this._rememberFailure("fips", baseUrl);
                this.reportError("FIPS federation Nostr discovery failed", baseUrl, errorMessage(error));
            });
            return;
        }

        const serviceName = this._tag(event, "service");
        if (!serviceName) return;
        const remoteRoot = this._tag(event, "pln-root");
        const localIdentity = await this.getPollenIdentity();
        if (localIdentity.rootHash && !remoteRoot) {
            this.trace("pollen cluster unknown", `server=${serverId}`, `service=${serviceName}`);
            return;
        }
        if (remoteRoot && localIdentity.rootHash && remoteRoot !== localIdentity.rootHash) {
            this.trace(
                "pollen cluster mismatch",
                `server=${serverId}`,
                `remoteRoot=${remoteRoot.slice(0, 12)}`,
                `localRoot=${localIdentity.rootHash.slice(0, 12)}`
            );
            return;
        }
        if (this._isFailureSuppressed("pollen", serviceName)) {
            this.trace("pollen connect suppressed", serviceName);
            return;
        }

        this.trace("pollen nostr event", `server=${serverId}`, `service=${serviceName}`, `pubkey=${event.pubkey}`);
        await this.connectPollenService(serverId, serviceName).catch(error => {
            this._rememberFailure("pollen", serviceName);
            this.reportError("Pollen federation connect failed", serviceName, errorMessage(error));
        });
    }

    async _handlePollenJoinRequest(event) {
        if (!this.config.pollen.clusterBootstrap) return;
        if (!this._isKnownRecipient(event.pubkey) || !this._hasTag(event, "p", this.config.nostr.pubkey)) return;

        const subjectNodeId = this._tag(event, "pln-node");
        if (!subjectNodeId) return;
        const identity = await this.getPollenIdentity();
        if (!identity.canInvite) return;

        const token = await this.createPollenInvite(event.pubkey, subjectNodeId);
        if (!token) return;

        const content = this._encryptFor(event.pubkey, JSON.stringify({
            token,
            serverId: this.config.serverId,
            serviceName: this.config.pollen.serviceName,
            rootHash: identity.rootHash,
            issuedAt: Math.floor(Date.now() / 1000)
        }));
        const invite = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", "pollen-invite"],
                ["protocol", POLLEN_FEDERATION_PROTOCOL],
                ...this._publicNetworkTags(),
                ["p", event.pubkey],
                ["server", this.config.serverId],
                ...this._pollenIdentityTags(identity)
            ],
            content
        }, this.config.nostr.secretKey);
        this._publishEvent("pollen invite", invite, null, event.pubkey);
    }

    async _handlePollenInvite(event) {
        if (!this.config.pollen.clusterBootstrap || !this._hasTag(event, "p", this.config.nostr.pubkey)) return;
        if (!this._isKnownRecipient(event.pubkey)) return;

        let payload;
        try {
            payload = JSON.parse(this._decryptFrom(event.pubkey, event.content || ""));
        } catch (error) {
            this.reportError("Pollen federation invite decrypt failed", event.pubkey, errorMessage(error));
            return;
        }
        if (!payload.token) return;
        await this.joinPollenInvite(payload).catch(error => {
            this.reportError("Pollen federation invite join failed", event.pubkey, errorMessage(error));
        });
    }

    _publishEvent(label, event, socket, target) {
        const message = JSON.stringify(["EVENT", event]);
        if (socket) {
            if (socket.readyState === WebSocket.OPEN) socket.send(message);
            this.trace(label, "socket", target, this._eventScopeLabel());
            return;
        }

        for (const relaySocket of this.relaySockets.values()) {
            if (relaySocket.readyState === WebSocket.OPEN) relaySocket.send(message);
        }
        this.trace(label, `openRelays=${this._openRelayCount()}`, target, this._eventScopeLabel());
    }

    _openRelayCount() {
        return [...this.relaySockets.values()].filter(relaySocket => relaySocket.readyState === WebSocket.OPEN).length;
    }

    _isFailureSuppressed(kind, target) {
        const until = this.failureBackoff.get(`${kind}:${target}`) || 0;
        if (until <= Date.now()) return false;
        return true;
    }

    _rememberFailure(kind, target) {
        this.failureBackoff.set(`${kind}:${target}`, Date.now() + DISCOVERY_FAILURE_BACKOFF_MS);
    }

    _announcePollenJoinRequest(identity, socket) {
        if (!identity.nodeId) return;
        if (!this._canAdvertise()) {
            this.trace("pollen join request skipped", "no-trusted-or-public-discovery");
            return;
        }
        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ...this._baseDiscoveryTags("pollen-join-request", POLLEN_FEDERATION_PROTOCOL),
                ["pln-node", identity.nodeId],
                ["room", this.config.pollen.room]
            ],
            content: ""
        }, this.config.nostr.secretKey);
        this._publishEvent("pollen join request", event, socket, identity.nodeId);
    }

    _isEventForThisNetwork(event) {
        return this._eventDecision(event).accepted;
    }

    _isKnownRecipient(pubkey) {
        return this.config.nostr.recipientPubkeys.includes(pubkey);
    }

    _baseDiscoveryTags(type, protocol) {
        return [
            ["type", type],
            ["protocol", protocol],
            ...this.config.nostr.recipientPubkeys.map(pubkey => ["p", pubkey]),
            ...this._publicNetworkTags(),
            ["server", this.config.serverId]
        ].filter(Boolean);
    }

    _publicNetworkTags() {
        return this._usesPublicNetwork()
            ? [["d", this.config.nostr.networkId], ["network", this.config.nostr.networkId]]
            : [];
    }

    _eventScopeLabel() {
        return this._usesPublicNetwork() ? this.config.nostr.networkId : "wot";
    }

    _pollenIdentityTags(identity = {}) {
        return [
            identity.nodeId ? ["pln-node", identity.nodeId] : null,
            identity.rootHash ? ["pln-root", identity.rootHash] : null
        ].filter(Boolean);
    }

    _encryptFor(pubkey, plaintext) {
        return nip44.encrypt(plaintext, nip44.getConversationKey(this.config.nostr.secretKey, pubkey));
    }

    _decryptFrom(pubkey, ciphertext) {
        return nip44.decrypt(ciphertext, nip44.getConversationKey(this.config.nostr.secretKey, pubkey));
    }

    _tag(event, name) {
        return event.tags?.find(tag => tag[0] === name)?.[1] || "";
    }

    _hasTag(event, name, value) {
        return (event.tags || []).some(tag => tag[0] === name && tag[1] === value);
    }

    _eventDecision(event) {
        if (!event || event.kind !== FEDERATION_KIND) return {accepted: false, reason: "wrong-kind"};
        if (event.pubkey === getPublicKey(this.config.nostr.secretKey)) return {accepted: false, reason: "self"};

        const type = this._tag(event, "type");
        if (!type) return {accepted: false, reason: "missing-type"};

        const protocol = this._tag(event, "protocol");
        const validProtocol = type.startsWith("fips-")
            ? protocol === FIPS_FEDERATION_PROTOCOL
            : protocol === POLLEN_FEDERATION_PROTOCOL;
        if (!validProtocol) return {accepted: false, reason: "protocol-mismatch"};
        if (!this._tag(event, "server")) return {accepted: false, reason: "missing-server"};
        if (type === "fips-federation" && !(this._tag(event, "base") || this._tag(event, "url"))) {
            return {accepted: false, reason: "missing-base"};
        }
        if (type === "pollen-federation" && !this._tag(event, "service")) {
            return {accepted: false, reason: "missing-service"};
        }

        const trusted = this._isKnownRecipient(event.pubkey);
        const publicNetwork = this._isPublicNetworkEvent(event);
        if (!trusted && !publicNetwork) return {accepted: false, reason: "untrusted-author"};

        const eventNetwork = this._tag(event, "d") || this._tag(event, "network");
        if (eventNetwork && this.config.nostr.networkId && eventNetwork !== this.config.nostr.networkId) {
            return {accepted: false, reason: "network-mismatch"};
        }

        if (type === "pollen-invite" || type === "pollen-join-request") {
            if (!this._hasTag(event, "p", this.config.nostr.pubkey)) return {accepted: false, reason: "not-addressed"};
        }

        return {accepted: true, reason: trusted ? "trusted-author" : "explicit-public-network"};
    }

    _usesPublicNetwork() {
        return this.config.nostr.discoveryMode === "public" && !!this.config.nostr.networkId;
    }

    _canAdvertise() {
        return this.config.nostr.recipientPubkeys.length > 0 || this._usesPublicNetwork();
    }

    _isPublicNetworkEvent(event) {
        return this._usesPublicNetwork() && (this._tag(event, "d") || this._tag(event, "network")) === this.config.nostr.networkId;
    }

    _filterSummary(filter) {
        return {
            kinds: filter.kinds,
            authors: filter.authors?.length || 0,
            p: filter["#p"]?.map(pubkey => pubkey.slice(0, 8)),
            d: filter["#d"]
        };
    }
}
