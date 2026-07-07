/* eslint-disable no-undef */

const NostrMeshProtocol = {
    kind: 25050,
    presenceHeartbeatMs: 25000,
    presenceTtlSeconds: 90,
    routeDescriptorTtlSeconds: 60,
    storageKey: "meshdrop_nostr_mesh_enabled",
    routeTypes: ["fips", "pollen"],
    routeCapabilityTagsByType: {
        fips: "fips-route",
        pollen: "pollen-route"
    },

    readEnabled(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) === "true";
    },

    hasEnabledPreference(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) !== null;
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    enabledFromConfig(config) {
        if (!globalThis.RuntimeCapabilities) return true;

        return globalThis.RuntimeCapabilities.transportSupported(config, "nostr", true)
            && globalThis.RuntimeCapabilities.transportSupported(config, "webrtc", true);
    },

    networkId(_identity, config = null) {
        return config?.nostrMesh?.room || "";
    },

    trustedPubkeys(identity = null) {
        return [...new Set((identity?.followPubkeys || [])
            .filter(pubkey => NostrDiscoveryProtocol.pubkeyRegex.test(pubkey || ""))
            .map(pubkey => pubkey.toLowerCase())
            .filter(pubkey => pubkey !== identity?.pubkey?.toLowerCase()))];
    },

    subscriptionFilters(identity = null, config = null, since = Math.floor(Date.now() / 1000) - 5) {
        const room = this.networkId(identity, config);
        if (room) return [{kinds: [this.kind], since, "#r": [room]}];

        const trusted = this.trustedPubkeys(identity);
        if (!trusted.length) return [];

        const filters = [];
        for (let index = 0; index < trusted.length; index += 50) {
            filters.push({
                kinds: [this.kind],
                since,
                authors: trusted.slice(index, index + 50)
            });
        }
        return filters;
    },

    relayUrlsFromConfig(config) {
        const configuredRelays = config?.nostrMesh?.relays || NostrDiscoveryProtocol.rtcAnnouncementRelays;
        return RelaySettingsPreferences.webRtcRelays(configuredRelays);
    },

    eventType(event) {
        return this.tagValue(event, "type");
    },

    room(event) {
        return this.tagValue(event, "r");
    },

    recipient(event) {
        return this.tagValue(event, "p");
    },

    recipients(event) {
        return (event.tags || [])
            .filter(tag => tag[0] === "p" && tag[1])
            .map(tag => tag[1]);
    },

    isAddressedTo(event, pubkey) {
        return !!pubkey && this.recipients(event).includes(pubkey);
    },

    tagValue(event, tagName) {
        const tag = (event.tags || []).find(tag => tag[0] === tagName && tag[1]);
        return tag ? tag[1] : "";
    },

    hasTag(event, tagName, value) {
        return (event.tags || []).some(tag => tag[0] === tagName && tag[1] === value);
    },

    meshTags() {
        return [
            ["client", "meshdrop"],
            ["protocol", "nip100-webrtc"],
            ["capability", "meshdrop"],
            ["capability", "webrtc"]
        ];
    },

    presenceCapabilityTags(routeCapabilities = [], sessionPeerId = "", expiresAt = 0) {
        const tags = [...this.meshTags()];
        const normalizedRouteTypes = [...new Set(routeCapabilities
            .map(routeType => this.normalizeRouteType(routeType))
            .filter(Boolean))];
        for (const routeType of normalizedRouteTypes) {
            tags.push(["capability", this.routeCapabilityTagsByType[routeType]]);
        }
        if (sessionPeerId) tags.push(["peer", sessionPeerId]);
        if (expiresAt) tags.push(["expiration", String(expiresAt)]);
        return tags;
    },

    advertisesMeshDropWebRtc(event) {
        return this.hasTag(event, "client", "meshdrop")
            && this.hasTag(event, "capability", "meshdrop")
            && this.hasTag(event, "capability", "webrtc");
    },

    normalizeRouteType(routeType) {
        return this.routeTypes.includes(routeType) ? routeType : "";
    },

    routeCapabilities(event) {
        return this.routeTypes.filter(routeType => this.hasTag(
            event,
            "capability",
            this.routeCapabilityTagsByType[routeType]
        ));
    },

    eventExpired(event, nowSeconds = Math.floor(Date.now() / 1000)) {
        const expiresAt = Number(this.tagValue(event, "expiration") || 0);
        return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt < nowSeconds;
    },

    expiry(seconds = this.routeDescriptorTtlSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
        return nowSeconds + seconds;
    },

    sessionPeerId() {
        if (globalThis.crypto?.randomUUID) return `meshdrop-${globalThis.crypto.randomUUID()}`;
        return `meshdrop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    },

    peerFromEvent(event, profile = null) {
        const displayName = this.tagValue(event, "name") || `npub ${event.pubkey.slice(0, 8)}`;

        return {
            id: event.pubkey,
            rtcSupported: true,
            sessionPeerId: this.tagValue(event, "peer"),
            routeCapabilities: this.routeCapabilities(event),
            nostrIdentity: {
                type: "nostr",
                pubkey: event.pubkey,
                displayName: profile?.displayName || displayName,
                picture: profile?.picture || "",
                verified: true
            },
            name: {
                model: null,
                os: "Nostr",
                browser: "Nostr",
                type: null,
                deviceName: "Nostr peer",
                displayName: profile?.displayName || displayName
            }
        };
    },

    signalType(message) {
        if (message.sdp) return message.sdp.type;
        if (message.ice) return "candidate";
        return "";
    },

    signalContent(message) {
        const session = message.sessionId ? {sessionId: message.sessionId} : {};
        if (message.sdp) return {sdp: message.sdp, ...session};
        if (message.ice) return {ice: message.ice, ...session};
        return null;
    }
};

globalThis.NostrMeshProtocol = NostrMeshProtocol;

class NostrMeshConnection {

    constructor() {
        this.$button = $("nostr-mesh");
        this._active = false;
        this._config = {};
        this._sockets = new Map();
        this._seenEvents = new Set();
        this._peers = new Set();
        this._subscriptionId = `meshdrop-${Math.random().toString(36).slice(2)}`;
        this._presenceHeartbeatId = null;
        this._preferredActive = NostrMeshProtocol.readEnabled();
        this._connecting = false;
        this._configLoaded = false;
        this._sessionPeerId = NostrMeshProtocol.sessionPeerId();
        this._pendingRouteRequests = new Map();

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => {
            this._config = e.detail || {};
            this._configLoaded = true;
            if (!NostrMeshProtocol.enabledFromConfig(this._config)) this.disconnect(false, false);
            this._render();
            if (NostrMeshProtocol.enabledFromConfig(this._config)) this._restorePreferredActive();
        });
        Events.on("nostr-identity-changed", e => this._onIdentityChanged(e.detail));
        Events.on("nostr-signer-available-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        Events.on("nostr-route-request-needed", e => {
            this._requestPrivateRoute(e.detail).catch(error => {
                this._trace("encrypted route request rejected", `reason=${error.message || "publish-failed"}`);
            });
        });
        Events.on("relay-settings-changed", _ => this._onRelaySettingsChanged());
        Events.on("pagehide", _ => this.disconnect(false));
        globalThis.meshdropNostrMesh = this;
    }

    async toggle() {
        if (this._active) {
            this.disconnect();
            return;
        }

        await this.connect();
    }

    async connect({notify = true, remember = true} = {}) {
        if (this._active || this._connecting) return;

        const identityController = globalThis.meshdropNostrIdentity;
        const identity = identityController?.getIdentity();

        if (!identity) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-identity-required"));
            return;
        }

        if (!NostrMeshProtocol.enabledFromConfig(this._config)) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-runtime-unsupported"));
            return;
        }

        if (!window.isRtcSupported) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-webrtc-required"));
            return;
        }

        if (!identityController.canEncrypt()) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-encryption-required"));
            return;
        }

        this._connecting = true;
        try {
            const hydratedIdentity = await identityController.ensureFollowListLoaded();
            this._identityController = identityController;
            this._identity = hydratedIdentity || identity;
            this._room = NostrMeshProtocol.networkId(this._identity, this._config);
            this._trustedPubkeys = new Set(NostrMeshProtocol.trustedPubkeys(this._identity));
            this._relayUrls = NostrMeshProtocol.relayUrlsFromConfig(this._config);
            this._trace(
                "trusted npub set loaded",
                `mode=${this._room ? "explicit-room" : "wot"}`,
                `status=${this._identity.followListStatus || "unknown"}`,
                `count=${this._trustedPubkeys.size}`,
                `sample=${[...this._trustedPubkeys].slice(0, 3).map(pubkey => pubkey.slice(0, 8)).join(",") || "none"}`
            );
            this._active = true;
            this._connectRelays();
            this._startPresenceHeartbeat();
            this._render();
            if (remember) this._setPreferredActive(true);
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-connected"));
        } finally {
            this._connecting = false;
        }
    }

    disconnect(notify = true, remember = notify) {
        if (!this._active && !this._sockets.size) return;

        if (this._active) {
            this._publishPresence("disconnect");
        }

        this._active = false;
        this._connecting = false;
        this._stopPresenceHeartbeat();
        this._removeKnownPeers();
        this._peers.clear();
        for (const socket of this._sockets.values()) {
            socket.onclose = null;
            socket.close();
        }
        this._sockets.clear();
        this._render();

        if (remember) this._setPreferredActive(false);
        if (notify) {
            Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-disconnected"));
        }
    }

    _onIdentityChanged(identity) {
        if (!identity?.pubkey) {
            this.disconnect(false);
            this._identity = null;
            this._render();
            return;
        }

        if (this._identity?.pubkey && this._identity.pubkey !== identity.pubkey) {
            this.disconnect(false);
        }

        this._identity = {
            ...this._identity,
            ...identity
        };
        this._render();
        this._restorePreferredActive();
    }

    _setPreferredActive(enabled) {
        this._preferredActive = !!enabled;
        NostrMeshProtocol.writeEnabled(this._preferredActive);
    }

    _restorePreferredActive() {
        if (!this._preferredActive || this._active || this._connecting || !this._configLoaded) return;

        this.connect({notify: false, remember: false}).catch(error => {
            console.warn("Nostr mesh restore failed", error);
        });
    }

    _removeKnownPeers() {
        for (const peerId of this._peers) {
            Events.fire("peer-left", {
                peerId,
                roomType: "nostr",
                roomId: this._room,
                disconnect: true
            });
        }
    }

    send(message) {
        if (!this._active || message.type !== "signal") return;

        const signalType = NostrMeshProtocol.signalType(message);
        const content = NostrMeshProtocol.signalContent(message);
        if (!signalType || !content) return;

        this._publishEncryptedSignal(signalType, message.to, content);
    }

    _connectRelays() {
        this._relayUrls.forEach(relayUrl => this._connectRelay(relayUrl));
    }

    _startPresenceHeartbeat() {
        this._stopPresenceHeartbeat();
        this._presenceHeartbeatId = setInterval(
            () => this._publishPresence("connect"),
            NostrMeshProtocol.presenceHeartbeatMs
        );
    }

    _stopPresenceHeartbeat() {
        if (!this._presenceHeartbeatId) return;

        clearInterval(this._presenceHeartbeatId);
        this._presenceHeartbeatId = null;
    }

    _connectRelay(relayUrl) {
        if (this._sockets.has(relayUrl)) return;

        const socket = new WebSocket(relayUrl);
        socket.onopen = _ => {
            this._subscribe(socket);
            this._publishPresence("connect", socket);
        };
        socket.onmessage = event => this._onRelayMessage(event.data);
        socket.onerror = error => {
            console.error("Nostr mesh relay error", relayUrl, error);
            Events.fire("notify-user", Localization.getTranslation("notifications.nostr-mesh-relay-error"));
        };
        socket.onclose = _ => this._sockets.delete(relayUrl);
        this._sockets.set(relayUrl, socket);
    }

    _subscribe(socket) {
        const since = Math.floor(Date.now() / 1000) - 5;
        const filters = NostrMeshProtocol.subscriptionFilters(this._identity, this._config, since);
        this._trace("nostr discovery subscription filters", JSON.stringify(filters.map(filter => this._filterSummary(filter))));
        if (!filters.length) {
            this._trace("nostr discovery subscription skipped", "trusted-set-empty");
            return;
        }
        socket.send(JSON.stringify(["REQ", this._subscriptionId, ...filters]));
    }

    async _publishPresence(type, socket = null) {
        const routeCapabilities = this._routeCapabilities();
        const expiresAt = NostrMeshProtocol.expiry(NostrMeshProtocol.presenceTtlSeconds);
        const tags = [
            ["type", type],
            ...NostrMeshProtocol.presenceCapabilityTags(routeCapabilities, this._sessionPeerId, expiresAt)
        ];
        if (this._room) tags.splice(1, 0, ["r", this._room]);

        const event = await this._signEvent({
            kind: NostrMeshProtocol.kind,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: ""
        });

        this._trace(
            "minimal presence published",
            `type=${type}`,
            `peer=${this._sessionPeerId}`,
            `routes=${routeCapabilities.join(",") || "none"}`,
            `expires=${expiresAt}`
        );
        this._publishEvent(event, socket);
    }

    async _publishEncryptedSignal(type, recipient, content) {
        try {
            const encryptedContent = await this._identityController.encryptTo(recipient, JSON.stringify(content));
            const event = await this._signEvent({
                kind: NostrMeshProtocol.kind,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ["type", type],
                    ...NostrMeshProtocol.meshTags(),
                    ["p", recipient]
                ].concat(this._room ? [["r", this._room]] : []),
                content: encryptedContent
            });

            this._publishEvent(event);
        } catch (error) {
            console.error("Nostr mesh signal publish failed", error);
        }
    }

    async _publishEncryptedRouteEvent(type, recipient, content) {
        const encryptedContent = await this._identityController.encryptNip44To(recipient, JSON.stringify(content));
        const event = await this._signEvent({
            kind: NostrMeshProtocol.kind,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", type],
                ...NostrMeshProtocol.meshTags(),
                ["p", recipient]
            ].concat(this._room ? [["r", this._room]] : []),
            content: encryptedContent
        });

        this._publishEvent(event);
    }

    async _signEvent(event) {
        return this._identityController.signEvent(event);
    }

    _publishEvent(event, socket = null) {
        const message = JSON.stringify(["EVENT", event]);
        if (socket) {
            this._sendIfOpen(socket, message);
            return;
        }

        for (const relaySocket of this._sockets.values()) {
            this._sendIfOpen(relaySocket, message);
        }
    }

    _sendIfOpen(socket, message) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(message);
        }
    }

    _onRelayMessage(rawMessage) {
        let relayMessage;
        try {
            relayMessage = JSON.parse(rawMessage);
        } catch {
            return;
        }

        if (relayMessage[0] === "NOTICE") {
            console.warn("Nostr mesh relay notice", relayMessage[1]);
            return;
        }

        if (relayMessage[0] === "OK") {
            this._onRelayPublishResult(relayMessage);
            return;
        }

        if (relayMessage[0] !== "EVENT") return;
        const event = relayMessage[2];
        const decision = this._eventDecision(event);
        this._trace(
            "nostr discovery event",
            `accepted=${decision.accepted}`,
            `reason=${decision.reason}`,
            `type=${NostrMeshProtocol.eventType(event) || "unknown"}`,
            `pubkey=${event?.pubkey?.slice(0, 8) || "unknown"}`
        );
        if (!decision.accepted) return;

        this._seenEvents.add(event.id);
        const type = NostrMeshProtocol.eventType(event);

        if (type === "connect") {
            this._onPeerConnect(event);
        }
        else if (type === "disconnect") {
            this._onPeerDisconnect(event);
        }
        else if (type === "offer" || type === "answer" || type === "candidate") {
            this._onSignalEvent(event, type);
        }
        else if (type === "route-request") {
            this._onRouteRequestEvent(event);
        }
        else if (type === "route-response") {
            this._onRouteResponseEvent(event);
        }
    }

    _onRelayPublishResult(relayMessage) {
        const accepted = relayMessage[2] === true;
        if (accepted) return;

        const eventId = relayMessage[1] || "unknown event";
        const reason = relayMessage[3] || "relay rejected event";
        console.warn("Nostr mesh relay rejected publish", eventId, reason);
    }

    _shouldHandleEvent(event) {
        return this._eventDecision(event).accepted;
    }

    _eventDecision(event) {
        if (!event || event.kind !== NostrMeshProtocol.kind) return {accepted: false, reason: "wrong-kind"};
        if (!event.id) return {accepted: false, reason: "missing-id"};
        if (this._seenEvents.has(event.id)) return {accepted: false, reason: "duplicate"};
        if (event.pubkey === this._identity?.pubkey) return {accepted: false, reason: "self"};

        const type = NostrMeshProtocol.eventType(event);
        if (!type) return {accepted: false, reason: "missing-type"};

        const room = NostrMeshProtocol.room(event);
        if (this._room && room !== this._room) return {accepted: false, reason: "room-mismatch"};

        const trusted = this._trustedPubkeys?.has(event.pubkey?.toLowerCase()) === true;
        const publicRoomMode = !!this._room;
        if (!trusted && !publicRoomMode) return {accepted: false, reason: "untrusted-author"};

        if (type === "connect" || type === "disconnect") {
            if (NostrMeshProtocol.eventExpired(event)) {
                return {accepted: false, reason: "expired-presence"};
            }
            if (!NostrMeshProtocol.advertisesMeshDropWebRtc(event)) {
                return {accepted: false, reason: "missing-meshdrop-webrtc-capability"};
            }
            return {accepted: true, reason: trusted ? "trusted-presence" : "explicit-room-presence"};
        }

        if (!["offer", "answer", "candidate", "route-request", "route-response"].includes(type)) {
            return {accepted: false, reason: "unsupported-type"};
        }
        if (!NostrMeshProtocol.isAddressedTo(event, this._identity?.pubkey)) {
            return {accepted: false, reason: "not-addressed"};
        }
        if ((type === "route-request" || type === "route-response") && !event.content) {
            return {accepted: false, reason: "missing-encrypted-route-body"};
        }
        return {accepted: true, reason: trusted ? "trusted-signal" : "explicit-room-signal"};
    }

    _onPeerConnect(event) {
        this._peers.add(event.pubkey);
        this._render();
        Events.fire("peer-joined", {
            peer: NostrMeshProtocol.peerFromEvent(event),
            roomType: "nostr",
            roomId: this._room,
            isCaller: this._identity.pubkey > event.pubkey,
            transport: this
        });
        this._hydratePeerProfile(event.pubkey);
    }

    _onPeerDisconnect(event) {
        this._peers.delete(event.pubkey);
        this._render();
        Events.fire("peer-left", {
            peerId: event.pubkey,
            roomType: "nostr",
            roomId: this._room,
            disconnect: true
        });
    }

    async _onSignalEvent(event, type) {
        try {
            const decryptedContent = await this._identityController.decryptFrom(event.pubkey, event.content);
            const content = JSON.parse(decryptedContent);

            if (type === "offer") {
                this._peers.add(event.pubkey);
                this._render();
                Events.fire("peer-joined", {
                    peer: NostrMeshProtocol.peerFromEvent(event),
                    roomType: "nostr",
                    roomId: this._room,
                    isCaller: false,
                    transport: this
                });
                this._hydratePeerProfile(event.pubkey);
            }

            Events.fire("signal", {
                ...content,
                sender: {
                    id: event.pubkey,
                    rtcSupported: true
                }
            });
        } catch (error) {
            console.error("Nostr mesh signal handling failed", error);
        }
    }

    async _requestPrivateRoute(detail = {}) {
        if (!this._active) return false;
        const recipient = detail.recipientPubkey || detail.peerPubkey || detail.peerId;
        const routeType = NostrMeshProtocol.normalizeRouteType(detail.routeType);
        if (!NostrDiscoveryProtocol.pubkeyRegex.test(recipient || "")) {
            throw new Error("invalid-recipient");
        }
        if (!routeType) throw new Error("invalid-route-type");
        if (!this._identityController?.canNip44?.()) throw new Error("nip44-unavailable");

        const nonce = this._createRouteNonce();
        const expiresAt = NostrMeshProtocol.expiry();
        const pending = {
            nonce,
            routeType,
            sessionId: this._sessionPeerId,
            peerId: detail.peerId || recipient,
            recipient,
            expiresAt
        };
        const requestKey = this._routeRequestKey(recipient, routeType);
        this._pendingRouteRequests.set(requestKey, pending);
        try {
            await this._publishEncryptedRouteEvent("route-request", recipient, {
                version: 1,
                type: "route-request",
                routeType,
                nonce,
                sessionId: pending.sessionId,
                requesterPubkey: this._identity.pubkey,
                recipientPubkey: recipient,
                expiresAt
            });
        } catch (error) {
            this._pendingRouteRequests.delete(requestKey);
            throw error;
        }
        this._trace(
            "encrypted route request sent",
            `route=${routeType}`,
            `peer=${recipient.slice(0, 8)}`,
            `expires=${expiresAt}`
        );
        return true;
    }

    async _onRouteRequestEvent(event) {
        let content;
        try {
            content = await this._decryptRouteEvent(event);
        } catch (error) {
            this._trace("encrypted route request rejected", `peer=${event.pubkey?.slice(0, 8) || "unknown"}`, `reason=${error.message || "decrypt-failed"}`);
            return;
        }

        const decision = this._routeRequestDecision(event, content);
        if (!decision.accepted) {
            this._trace("encrypted route request rejected", `peer=${event.pubkey.slice(0, 8)}`, `reason=${decision.reason}`);
            return;
        }

        const descriptor = await this._localRouteDescriptor(content.routeType, event.pubkey);
        if (!descriptor) {
            this._trace("encrypted route request rejected", `peer=${event.pubkey.slice(0, 8)}`, `route=${content.routeType}`, "reason=route-unavailable");
            return;
        }

        const expiresAt = NostrMeshProtocol.expiry();
        const responseDescriptor = {
            ...descriptor,
            expiresAt
        };
        if (!this._joinPrivateRoute(content.routeType, responseDescriptor)) {
            this._trace("encrypted route request rejected", `peer=${event.pubkey.slice(0, 8)}`, `route=${content.routeType}`, "reason=local-route-inactive");
            return;
        }
        await this._publishEncryptedRouteEvent("route-response", event.pubkey, {
            version: 1,
            type: "route-response",
            routeType: content.routeType,
            nonce: content.nonce,
            sessionId: content.sessionId,
            responderPubkey: this._identity.pubkey,
            recipientPubkey: event.pubkey,
            expiresAt,
            descriptor: responseDescriptor
        });
        this._trace("encrypted route response sent", `peer=${event.pubkey.slice(0, 8)}`, `route=${content.routeType}`, `expires=${expiresAt}`);
    }

    async _onRouteResponseEvent(event) {
        let content;
        try {
            content = await this._decryptRouteEvent(event);
        } catch (error) {
            this._trace("encrypted route response rejected", `peer=${event.pubkey?.slice(0, 8) || "unknown"}`, `reason=${error.message || "decrypt-failed"}`);
            return;
        }

        const decision = this._routeResponseDecision(event, content);
        if (!decision.accepted) {
            this._trace("encrypted route response rejected", `peer=${event.pubkey.slice(0, 8)}`, `reason=${decision.reason}`);
            return;
        }

        if (!this._joinPrivateRoute(content.routeType, decision.descriptor)) {
            this._trace("encrypted route response rejected", `peer=${event.pubkey.slice(0, 8)}`, `route=${content.routeType}`, "reason=local-route-inactive");
            return;
        }
        this._pendingRouteRequests.delete(this._routeRequestKey(event.pubkey, content.routeType));
        this._trace("encrypted route response accepted", `peer=${event.pubkey.slice(0, 8)}`, `route=${content.routeType}`);
    }

    async _decryptRouteEvent(event) {
        if (!this._identityController?.canNip44?.()) throw new Error("nip44-unavailable");
        const plaintext = await this._identityController.decryptNip44From(event.pubkey, event.content);
        return JSON.parse(plaintext);
    }

    _routeRequestDecision(event, content = {}) {
        const routeType = NostrMeshProtocol.normalizeRouteType(content.routeType);
        if (content.type && content.type !== "route-request") return {accepted: false, reason: "wrong-body-type"};
        if (!routeType) return {accepted: false, reason: "invalid-route-type"};
        if (!content.nonce || typeof content.nonce !== "string") return {accepted: false, reason: "missing-nonce"};
        if (!content.sessionId || typeof content.sessionId !== "string") return {accepted: false, reason: "missing-session"};
        if (content.requesterPubkey && content.requesterPubkey !== event.pubkey) {
            return {accepted: false, reason: "requester-mismatch"};
        }
        if (content.recipientPubkey !== this._identity?.pubkey) return {accepted: false, reason: "recipient-mismatch"};
        if (this._isExpired(content.expiresAt)) return {accepted: false, reason: "expired-descriptor"};
        return {accepted: true, reason: "route-request"};
    }

    _routeResponseDecision(event, content = {}) {
        const routeType = NostrMeshProtocol.normalizeRouteType(content.routeType);
        if (content.type && content.type !== "route-response") return {accepted: false, reason: "wrong-body-type"};
        if (!routeType) return {accepted: false, reason: "invalid-route-type"};
        const pending = this._pendingRouteRequests.get(this._routeRequestKey(event.pubkey, routeType));
        if (!pending) return {accepted: false, reason: "unsolicited-response"};
        if (content.nonce !== pending.nonce) return {accepted: false, reason: "nonce-mismatch"};
        if (content.sessionId !== pending.sessionId) return {accepted: false, reason: "session-mismatch"};
        if (content.responderPubkey && content.responderPubkey !== event.pubkey) {
            return {accepted: false, reason: "responder-mismatch"};
        }
        if (content.recipientPubkey !== this._identity?.pubkey) return {accepted: false, reason: "recipient-mismatch"};
        if (this._isExpired(content.expiresAt)) return {accepted: false, reason: "expired-descriptor"};
        const descriptor = this._normalizeRouteDescriptor(routeType, content.descriptor);
        if (!descriptor) return {accepted: false, reason: "invalid-descriptor"};
        if (this._isExpired(descriptor.expiresAt)) return {accepted: false, reason: "expired-descriptor"};
        return {accepted: true, reason: "route-response", descriptor};
    }

    _normalizeRouteDescriptor(routeType, descriptor = {}) {
        if (!descriptor || typeof descriptor !== "object") return null;
        if (descriptor.routeType && descriptor.routeType !== routeType) return null;
        const rooms = [...new Set((descriptor.rooms || [])
            .map(room => globalThis.NpubNetworkProtocol?.normalizeRoom?.(room) || "")
            .filter(Boolean))];
        if (!rooms.length) return null;
        return {
            routeType,
            rooms,
            expiresAt: Number(descriptor.expiresAt || 0)
        };
    }

    _isExpired(expiresAt, nowSeconds = Math.floor(Date.now() / 1000)) {
        const normalized = Number(expiresAt || 0);
        return !Number.isFinite(normalized) || normalized <= nowSeconds;
    }

    async _localRouteDescriptor(routeType, peerPubkey) {
        const controller = this._routeController(routeType);
        if (!controller?.routeDescriptorFor) return null;

        const descriptor = await controller.routeDescriptorFor(peerPubkey);
        return this._normalizeRouteDescriptor(routeType, {
            ...descriptor,
            expiresAt: NostrMeshProtocol.expiry()
        });
    }

    _joinPrivateRoute(routeType, descriptor) {
        const controller = this._routeController(routeType);
        return controller?.joinRouteDescriptor?.(descriptor) === true;
    }

    _routeController(routeType) {
        if (routeType === "fips") return globalThis.meshdropFipsDiscovery;
        if (routeType === "pollen") return globalThis.meshdropPollenTransfer;
        return null;
    }

    _routeCapabilities() {
        const capabilities = [];
        if (globalThis.meshdropFipsDiscovery?.isActive?.()) capabilities.push("fips");
        if (globalThis.meshdropPollenTransfer?.isActive?.()) capabilities.push("pollen");
        return capabilities;
    }

    _routeRequestKey(pubkey, routeType) {
        return `${pubkey}:${routeType}`;
    }

    _createRouteNonce() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    async _hydratePeerProfile(pubkey) {
        if (!globalThis.meshdropNostrRelays) return;

        try {
            const discovery = await globalThis.meshdropNostrRelays.lookupUser(pubkey);
            if (!discovery.profile?.displayName && !discovery.profile?.picture) return;

            Events.fire("peer-profile-changed", {
                peerId: pubkey,
                displayName: discovery.profile.displayName,
                picture: discovery.profile.picture
            });
        } catch (error) {
            console.warn("Nostr peer profile lookup failed", error);
        }
    }

    _render() {
        if (!this.$button) return;

        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        const supported = NostrMeshProtocol.enabledFromConfig(this._config);
        this.$button.toggleAttribute("hidden", !identity || !supported);

        const translationKey = this._active
            ? "header.nostr-mesh-disconnect"
            : "header.nostr-mesh-connect";

        this.$button.title = Localization.getTranslation(`${translationKey}_title`);
        this.$button.classList.toggle("selected", this._active);
        const userCount = globalThis.meshdropPeerAvailabilityCounts?.nostr;
        if (this._active) {
            this.$button.setAttribute("data-badge", String(typeof userCount === "number" ? userCount : this._peers.size));
        } else {
            this.$button.removeAttribute("data-badge");
        }
        Events.fire("footer-discovery-changed");
    }

    async _onRelaySettingsChanged() {
        if (!this._active) return;

        this.disconnect(false);
        await this.connect();
    }

    _filterSummary(filter) {
        return {
            kinds: filter.kinds,
            since: filter.since,
            authors: filter.authors?.length || 0,
            p: filter["#p"]?.map(pubkey => pubkey.slice(0, 8)),
            r: filter["#r"]
        };
    }

    _trace(...parts) {
        console.info("[meshdrop:nostr]", ...parts);
    }
}

globalThis.NostrMeshConnection = NostrMeshConnection;
