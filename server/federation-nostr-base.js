import {finalizeEvent, getPublicKey, nip44} from "nostr-tools";
import {WebSocket} from "ws";

import {normalizeNpubDiscoveryNetworkId} from "./npub-network.js";
import {
    DISCOVERY_FAILURE_BACKOFF_MS,
    FEDERATION_KIND,
    FIPS_FEDERATION_PROTOCOL,
    POLLEN_FEDERATION_PROTOCOL,
    errorMessage,
    noop
} from "./federation-nostr-protocol.js";

export class FederationNostrDiscoveryBase {

    constructor({
        config,
        trace = noop,
        getFipsBaseUrl = () => "",
        getPollenIdentity = async () => ({}),
        localServerDescriptor = () => ({}),
        localSnapshot = () => ({}),
        receiveFederationEvents = async () => ({accepted: 0}),
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
        this.localServerDescriptor = localServerDescriptor;
        this.localSnapshot = localSnapshot;
        this.receiveFederationEvents = receiveFederationEvents;
        this.discoverHttpServer = discoverHttpServer;
        this.connectPollenService = connectPollenService;
        this.createPollenInvite = createPollenInvite;
        this.joinPollenInvite = joinPollenInvite;
        this.reportError = reportError;
        this.relaySockets = new Map();
        this.seenEvents = new Set();
        this.failureBackoff = new Map();
        this.localRooms = new Map([["fips", new Map()], ["pollen", new Map()]]);
        this.loggedAnnouncementSkips = new Set();
    }

    addLocalRoom(roomType, roomId) {
        const rooms = this._roomMap(roomType);
        const normalized = normalizeNpubDiscoveryNetworkId(roomId);
        if (!rooms || !normalized) return false;

        const count = rooms.get(normalized) || 0;
        rooms.set(normalized, count + 1);
        if (count === 0) {
            this._refreshRelaySubscriptions();
            this._announceClientRoom(roomType).catch(noop);
        }
        return true;
    }

    removeLocalRoom(roomType, roomId) {
        const rooms = this._roomMap(roomType);
        const normalized = normalizeNpubDiscoveryNetworkId(roomId);
        if (!rooms || !normalized || !rooms.has(normalized)) return false;

        const count = rooms.get(normalized) || 0;
        if (count > 1) {
            rooms.set(normalized, count - 1);
            return true;
        }
        rooms.delete(normalized);
        this._refreshRelaySubscriptions();
        return true;
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

    _publishEvent(label, event, socket, target, scope = null) {
        const message = JSON.stringify(["EVENT", event]);
        if (socket) {
            if (socket.readyState === WebSocket.OPEN) socket.send(message);
            this.trace(label, "socket", target, this._eventScopeLabel(scope));
            return;
        }

        for (const relaySocket of this.relaySockets.values()) {
            if (relaySocket.readyState === WebSocket.OPEN) relaySocket.send(message);
        }
        this.trace(label, `openRelays=${this._openRelayCount()}`, target, this._eventScopeLabel(scope));
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

    _announcePollenJoinRequest(identity, socket, scopes = this._discoveryScopes("pollen")) {
        if (!identity.nodeId) return;
        if (!scopes.length) {
            this._traceAnnouncementSkip("pollen join request skipped", "no-client-trusted-or-public-discovery");
            return;
        }
        for (const scope of scopes) {
            const event = finalizeEvent({
                kind: FEDERATION_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ...this._baseDiscoveryTags("pollen-join-request", POLLEN_FEDERATION_PROTOCOL, scope),
                    ["pln-node", identity.nodeId],
                    ["room", scope.room]
                ],
                content: ""
            }, this.config.nostr.secretKey);
            this._publishEvent("pollen join request", event, socket, identity.nodeId, scope);
        }
    }

    _isEventForThisNetwork(event) {
        return this._eventDecision(event).accepted;
    }

    _isKnownRecipient(pubkey) {
        return this.config.nostr.recipientPubkeys.includes(pubkey);
    }

    _baseDiscoveryTags(type, protocol, scope = null) {
        return [
            ["type", type],
            ["protocol", protocol],
            ...(scope?.tags || this._configuredDiscoveryTags()),
            ["server", this.config.serverId]
        ].filter(Boolean);
    }

    _configuredDiscoveryTags() {
        return [
            ...this.config.nostr.recipientPubkeys.map(pubkey => ["p", pubkey]),
            ...this._publicNetworkTags()
        ];
    }

    _publicNetworkTags() {
        return this._usesPublicNetwork()
            ? [["d", this.config.nostr.networkId], ["network", this.config.nostr.networkId]]
            : [];
    }

    _roomNetworkTags(roomId) {
        return [["d", roomId], ["network", roomId]];
    }

    _eventScopeLabel(scope = null) {
        if (scope?.label) return scope.label;
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

    _encryptedFederationPayload(recipientPubkey, transport, scope = null, events = null) {
        if (!recipientPubkey) return "";
        const roomId = scope?.room || "";
        const snapshot = events ? null : this.localSnapshot(transport, roomId);
        const federationEvents = events || (snapshot?.peers || []).map(peer => ({
            type: "peer-joined",
            ...peer
        }));
        const payload = {
            version: 1,
            type: "federation-events",
            serverId: this.config.serverId,
            transport,
            server: this.localServerDescriptor(transport),
            events: federationEvents
        };
        return this._encryptFor(recipientPubkey, JSON.stringify(payload));
    }

    _decryptFederationPayload(event, serverId, transport) {
        if (!event.content) return null;
        let payload;
        try {
            payload = JSON.parse(this._decryptFrom(event.pubkey, event.content));
        }
        catch (error) {
            this.trace("nostr federation payload rejected", `server=${serverId}`, `reason=${errorMessage(error)}`);
            return null;
        }
        if (payload?.type !== "federation-events") return null;
        if (payload.serverId !== serverId) return null;
        if (payload.transport !== transport) return null;
        if (!Array.isArray(payload.events)) payload.events = [];
        return payload;
    }

    async _receiveFederationPayload(event, serverId, transport, descriptor = {}) {
        const payload = this._decryptFederationPayload(event, serverId, transport);
        if (!payload) return false;
        await this.receiveFederationEvents(payload, {
            ...descriptor,
            serverId,
            transport,
            relayPubkey: event.pubkey
        });
        this.trace("nostr federation payload accepted", `server=${serverId}`, `transport=${transport}`, `events=${payload.events.length}`);
        return true;
    }

    _recipientPubkeysForScope(scope = null) {
        const pubkeys = (scope?.tags || [])
            .filter(tag => tag[0] === "p")
            .map(tag => tag[1])
            .filter(Boolean);
        return [...new Set(pubkeys)];
    }

    publishFederationEvents(server, events = [], descriptor = {}) {
        if (!this.config.nostr.enabled || !server?.relayPubkey || !events.length) return false;
        const transport = server.transport;
        const protocol = transport === "fips" ? FIPS_FEDERATION_PROTOCOL : POLLEN_FEDERATION_PROTOCOL;
        const type = `${transport}-federation`;
        const room = server.room || this.config[transport]?.room || this.config.nostr.networkId || "";
        const content = this._encryptFor(server.relayPubkey, JSON.stringify({
            version: 1,
            type: "federation-events",
            serverId: this.config.serverId,
            transport,
            server: descriptor,
            events
        }));
        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", type],
                ["protocol", protocol],
                ["server", this.config.serverId],
                ["p", server.relayPubkey],
                ...(room ? [...this._roomNetworkTags(room), ["room", room]] : []),
                ...(descriptor.baseUrl ? [["base", descriptor.baseUrl]] : []),
                ...(descriptor.serviceName ? [["service", descriptor.serviceName]] : [])
            ],
            content
        }, this.config.nostr.secretKey);
        this._publishEvent("nostr federation relay", event, null, server.relayPubkey, room ? {label: room} : null);
        return true;
    }

    publishFederationSnapshot(recipientPubkey, transport, room = "") {
        const snapshot = this.localSnapshot(transport, room);
        const events = (snapshot?.peers || []).map(peer => ({
            type: "peer-joined",
            ...peer
        }));
        return this.publishFederationEvents({
            relayPubkey: recipientPubkey,
            transport,
            room
        }, events, this.localServerDescriptor(transport));
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

        const clientRoom = this._clientRoomForEvent(type, event);
        const trusted = this._isKnownRecipient(event.pubkey);
        const publicNetwork = this._isPublicNetworkEvent(event);
        if (!trusted && !publicNetwork && !clientRoom) return {accepted: false, reason: "untrusted-author"};

        const eventNetwork = this._tag(event, "d") || this._tag(event, "network");
        if (eventNetwork && this.config.nostr.networkId && eventNetwork !== this.config.nostr.networkId && !clientRoom) {
            return {accepted: false, reason: "network-mismatch"};
        }
        const eventRoom = this._tag(event, "room");
        if (clientRoom && eventRoom && eventRoom !== clientRoom) return {accepted: false, reason: "room-mismatch"};

        if (type === "pollen-invite" || type === "pollen-join-request") {
            if (!this._hasTag(event, "p", this.config.nostr.pubkey)) return {accepted: false, reason: "not-addressed"};
        }

        return {accepted: true, reason: trusted ? "trusted-author" : (clientRoom ? "client-wot-room" : "explicit-public-network")};
    }

    _usesPublicNetwork() {
        return this.config.nostr.discoveryMode === "public" && !!this.config.nostr.networkId;
    }

    _canAdvertise() {
        return this._discoveryScopes("fips").length > 0 || this._discoveryScopes("pollen").length > 0;
    }

    _isPublicNetworkEvent(event) {
        return this._usesPublicNetwork() && (this._tag(event, "d") || this._tag(event, "network")) === this.config.nostr.networkId;
    }

    _discoveryScopes(roomType) {
        const scopes = [];
        const configuredTags = this._configuredDiscoveryTags();
        if (configuredTags.length) {
            scopes.push({
                room: this.config[roomType]?.room || this.config.nostr.networkId || "",
                tags: configuredTags,
                label: this._eventScopeLabel()
            });
        }
        for (const roomId of this._activeRoomIds(roomType)) {
            scopes.push({
                room: roomId,
                tags: this._roomNetworkTags(roomId),
                label: roomId
            });
        }
        return this._dedupeObjects(scopes);
    }

    _roomMap(roomType) {
        return this.localRooms.get(roomType) || null;
    }

    _activeRoomIds(roomType = "") {
        if (roomType) return [...(this._roomMap(roomType)?.keys() || [])];

        const seen = new Set();
        for (const rooms of this.localRooms.values()) {
            for (const roomId of rooms.keys()) seen.add(roomId);
        }
        return [...seen];
    }

    _clientRoomForEvent(type, event) {
        const roomType = this._roomTypeForEventType(type);
        if (!roomType) return "";

        const eventNetwork = this._tag(event, "d") || this._tag(event, "network");
        return eventNetwork && this._roomMap(roomType)?.has(eventNetwork) ? eventNetwork : "";
    }

    _roomTypeForEventType(type) {
        if (type.startsWith("fips-")) return "fips";
        if (type.startsWith("pollen-")) return "pollen";
        return "";
    }

    async _announceClientRoom(roomType) {
        if (roomType === "fips") return this.announceFips();
        if (roomType === "pollen") return this.announcePollen();
    }

    _refreshRelaySubscriptions() {
        if (!this.config.nostr.enabled || !this.relaySockets.size) return;

        const filters = this.discoveryFilters();
        this.trace("nostr discovery subscription filters", JSON.stringify(filters.map(filter => this._filterSummary(filter))));
        for (const socket of this.relaySockets.values()) {
            if (socket.readyState !== WebSocket.OPEN) continue;
            socket.send(JSON.stringify(["CLOSE", this._subscriptionId()]));
            this._sendRelaySubscription(socket, filters);
        }
    }

    _sendRelaySubscription(socket, filters) {
        if (filters.length) {
            socket.send(JSON.stringify(["REQ", this._subscriptionId(), ...filters]));
        }
        else {
            this.trace("nostr discovery subscription skipped", "no-client-trusted-or-public-discovery");
        }
    }

    _subscriptionId() {
        return `meshdrop-fed-${this.config.serverId}`;
    }

    _traceAnnouncementSkip(label, reason) {
        const key = `${label}:${reason}`;
        if (this.loggedAnnouncementSkips.has(key)) return;
        this.loggedAnnouncementSkips.add(key);
        this.trace(label, reason);
    }

    _dedupeObjects(values) {
        const seen = new Set();
        return values.filter(value => {
            const key = JSON.stringify(value);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
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
