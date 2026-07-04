/* eslint-disable no-undef */

const NostrMeshProtocol = {
    kind: 25050,
    defaultRoomPrefix: "meshdrop",
    presenceHeartbeatMs: 25000,
    storageKey: "meshdrop_nostr_mesh_enabled",

    readEnabled(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) === "true";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    networkId(identity) {
        return identity?.pubkey ? `nostr:${identity.pubkey}` : "nostr";
    },

    recipientTags(identity) {
        const self = identity?.pubkey || "";
        const pubkeyRegex = NostrDiscoveryProtocol?.pubkeyRegex || /^[0-9a-f]{64}$/i;
        return [...new Set(identity?.followPubkeys || [])]
            .map(pubkey => String(pubkey || "").toLowerCase())
            .filter(pubkey => pubkey !== self && pubkeyRegex.test(pubkey))
            .map(pubkey => ["p", pubkey]);
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
        const tag = event.tags.find(tag => tag[0] === tagName && tag[1]);
        return tag ? tag[1] : "";
    },

    peerFromEvent(event, profile = null) {
        const displayName = this.tagValue(event, "name") || `npub ${event.pubkey.slice(0, 8)}`;

        return {
            id: event.pubkey,
            rtcSupported: true,
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
                browser: "Relay",
                type: null,
                deviceName: "Nostr relay peer",
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

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => {
            this._config = e.detail || {};
            this._configLoaded = true;
            this._restorePreferredActive();
        });
        Events.on("nostr-identity-changed", e => this._onIdentityChanged(e.detail));
        Events.on("nostr-signer-available-changed", _ => {
            this._render();
            this._restorePreferredActive();
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
            this._room = NostrMeshProtocol.networkId(this._identity);
            this._relayUrls = NostrMeshProtocol.relayUrlsFromConfig(this._config);
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
        socket.send(JSON.stringify([
            "REQ",
            this._subscriptionId,
            {kinds: [NostrMeshProtocol.kind], since, "#p": [this._identity.pubkey]}
        ]));
    }

    async _publishPresence(type, socket = null) {
        const event = await this._signEvent({
            kind: NostrMeshProtocol.kind,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", type],
                ...NostrMeshProtocol.recipientTags(this._identity),
                ["name", this._identity.displayName || `npub ${this._identity.pubkey.slice(0, 8)}`]
            ],
            content: ""
        });

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
                    ["p", recipient],
                    ["name", this._identity.displayName || `npub ${this._identity.pubkey.slice(0, 8)}`]
                ],
                content: encryptedContent
            });

            this._publishEvent(event);
        } catch (error) {
            console.error("Nostr mesh signal publish failed", error);
        }
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
        if (!this._shouldHandleEvent(event)) return;

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
    }

    _onRelayPublishResult(relayMessage) {
        const accepted = relayMessage[2] === true;
        if (accepted) return;

        const eventId = relayMessage[1] || "unknown event";
        const reason = relayMessage[3] || "relay rejected event";
        console.warn("Nostr mesh relay rejected publish", eventId, reason);
    }

    _shouldHandleEvent(event) {
        if (!event || event.kind !== NostrMeshProtocol.kind) return false;
        if (!event.id || this._seenEvents.has(event.id)) return false;
        if (event.pubkey === this._identity?.pubkey) return false;

        const type = NostrMeshProtocol.eventType(event);
        if (!type) return false;
        if (!NostrFollowPolicy.allowsPubkey(event.pubkey, this._identity)) return false;

        if (type === "connect" || type === "disconnect") {
            return NostrMeshProtocol.isAddressedTo(event, this._identity?.pubkey);
        }

        return NostrMeshProtocol.isAddressedTo(event, this._identity?.pubkey);
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
        this.$button.toggleAttribute("hidden", !identity);

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
}

globalThis.NostrMeshConnection = NostrMeshConnection;
