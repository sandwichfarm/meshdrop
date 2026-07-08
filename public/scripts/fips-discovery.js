/* eslint-disable no-undef */

function normalizeFipsDiscoveryRoom(room) {
    return /^npub-network:[a-z0-9:-]+$/i.test(String(room || "")) ? String(room) : "";
}

const FipsDiscoveryProtocol = {
    statusPath: "fips/status",
    storageKey: "meshdrop_fips_discovery_enabled",

    readEnabled(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) === "true";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    roomFromConfig(config) {
        return normalizeFipsDiscoveryRoom(config?.fips?.room);
    },

    enabledFromConfig(config) {
        return globalThis.RuntimeCapabilities
            ? globalThis.RuntimeCapabilities.transportSupported(config, "fips", !!config?.fips?.enabled)
            : !!config?.fips?.enabled;
    },

    summarizeStatus(status) {
        if (!status?.enabled) return {enabled: false, available: false, peerCount: 0};

        return {
            enabled: true,
            available: !!status.available,
            npub: status.npub || "",
            ipv6Addr: status.ipv6Addr || "",
            peerCount: Number(status.peerCount || status.peers?.length || 0),
            meshSize: Number(status.meshSize || 0),
            room: normalizeFipsDiscoveryRoom(status.room)
        };
    },

    endpoint(path) {
        const baseUrl = globalThis.__meshdropAndroidNativeBackend?.baseUrl;
        if (!baseUrl) return path;

        return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    }
};

globalThis.FipsDiscoveryProtocol = FipsDiscoveryProtocol;

class FipsDiscoveryController {

    constructor() {
        this.$button = $("fips-discovery");
        this._active = false;
        this._config = {};
        this._lastStatus = null;
        this._available = false;
        this._connecting = false;
        this._routeDescriptorsByRoom = new Map();
        this._preferredActive = FipsDiscoveryProtocol.readEnabled();
        this._notifyNextEnabled = true;

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => this._onConfig(e.detail || {}));
        Events.on("fips-status", e => this._onStatus(e.detail));
        Events.on("ws-disconnected", _ => {
            this._active = false;
            this._connecting = false;
            this._render();
        });
        globalThis.meshdropFipsDiscovery = this;
    }

    async toggle() {
        if (this._active) {
            this.disable();
            return;
        }
        if (this._connecting) return;

        await this.enable();
    }

    async enable({notify = true, remember = true} = {}) {
        if (!FipsDiscoveryProtocol.enabledFromConfig(this._config)) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-server-required"));
            return;
        }

        this._connecting = true;
        this._notifyNextEnabled = notify;
        this._render();

        let status;
        try {
            status = await this.fetchStatus();
        } catch {
            this._connecting = false;
            this._available = false;
            this._render();
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-unavailable"));
            return;
        }

        if (!status.available) {
            this._connecting = false;
            this._available = false;
            this._render();
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-unavailable"));
            return;
        }

        if (remember) this._setPreferredActive(true);
        Events.fire("join-fips-room", {rooms: await this._runtimeRooms({pairwise: false})});
    }

    disable(notify = true, remember = notify) {
        if (!this._active && !this._connecting) return;

        this._active = false;
        this._connecting = false;
        this._notifyNextEnabled = true;
        this._routeDescriptorsByRoom.clear();
        this._render();
        Events.fire("leave-fips-room");

        if (remember) this._setPreferredActive(false);
        if (notify) {
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-disabled"));
        }
    }

    isActive() {
        return this._active;
    }

    async fetchStatus() {
        const response = await fetch(FipsDiscoveryProtocol.endpoint(FipsDiscoveryProtocol.statusPath));
        if (!response.ok) throw new Error(`FIPS status failed with ${response.status}`);

        const status = FipsDiscoveryProtocol.summarizeStatus(await response.json());
        this._lastStatus = status;
        this._available = status.available;
        this._render();
        return status;
    }

    async _onConfig(config) {
        this._config = config;
        this._available = false;
        this._render();

        if (!FipsDiscoveryProtocol.enabledFromConfig(config)) return;

        try {
            await this.fetchStatus();
        } catch {
            this._available = false;
            this._render();
        }

        await this._restorePreferredActive();
    }

    _onStatus(status) {
        const summary = FipsDiscoveryProtocol.summarizeStatus(status);
        this._lastStatus = summary;
        this._available = summary.available;
        this._connecting = false;

        if (!summary.available) {
            this._active = false;
            this._render();
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-unavailable"));
            return;
        }

        this._active = true;
        this._render();
        if (this._notifyNextEnabled) {
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-enabled"));
        }
        this._notifyNextEnabled = true;
    }

    _setPreferredActive(enabled) {
        this._preferredActive = !!enabled;
        FipsDiscoveryProtocol.writeEnabled(this._preferredActive);
    }

    async _restorePreferredActive() {
        if (!this._preferredActive || this._active || this._connecting) return;
        if (!FipsDiscoveryProtocol.enabledFromConfig(this._config) || !this._available) return;

        await this.enable({notify: false, remember: false});
    }

    async routeDescriptorFor(peerPubkey) {
        if (!this._active || !this._available) return null;

        const identityController = globalThis.meshdropNostrIdentity;
        const identity = identityController?.getIdentity?.();
        if (!identity?.pubkey || !globalThis.NpubNetworkProtocol?.pairwiseRoom) return null;

        const pairwiseRoom = await globalThis.NpubNetworkProtocol.pairwiseRoom(identity.pubkey, peerPubkey);
        const rooms = [pairwiseRoom].filter(Boolean);
        const explicitRoom = this._config?.fips?.discoveryMode === "public"
            ? FipsDiscoveryProtocol.roomFromConfig(this._config)
            : "";
        if (explicitRoom) rooms.push(explicitRoom);

        const iceBridge = globalThis.RuntimeCapabilities?.iceBridgeDescriptor?.(this._config, "fips");
        return {
            routeType: "fips",
            rooms: [...new Set(rooms)],
            ...(iceBridge ? {iceBridge} : {})
        };
    }

    joinRouteDescriptor(descriptor = {}) {
        if (!this._active || !this._available) return false;
        const rooms = [...new Set((descriptor.rooms || [])
            .map(room => globalThis.NpubNetworkProtocol?.normalizeRoom?.(room) || "")
            .filter(Boolean))];
        if (!rooms.length) return false;

        this._rememberRouteDescriptor({...descriptor, routeType: "fips", rooms});
        Events.fire("join-fips-room", {rooms});
        return true;
    }

    routeMetadataForRoom(room) {
        const normalized = globalThis.NpubNetworkProtocol?.normalizeRoom?.(room) || "";
        const descriptor = this._routeDescriptorsByRoom.get(normalized);
        if (!descriptor) return null;
        const expiresAt = Number(descriptor.expiresAt || 0);
        if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000)) {
            this._routeDescriptorsByRoom.delete(normalized);
            return null;
        }
        return descriptor;
    }

    _rememberRouteDescriptor(descriptor = {}) {
        for (const room of descriptor.rooms || []) {
            const normalized = globalThis.NpubNetworkProtocol?.normalizeRoom?.(room) || "";
            if (normalized) this._routeDescriptorsByRoom.set(normalized, descriptor);
        }
    }

    async _runtimeRooms(options = {}) {
        const identityController = globalThis.meshdropNostrIdentity;
        const identity = await identityController?.ensureFollowListLoaded?.()
            || identityController?.getIdentity?.();
        return globalThis.NpubNetworkProtocol?.roomsForIdentity
            ? globalThis.NpubNetworkProtocol.roomsForIdentity(identity, {
                room: FipsDiscoveryProtocol.roomFromConfig(this._config),
                discoveryMode: this._config?.fips?.discoveryMode,
                pairwise: options.pairwise !== false
            })
            : [];
    }

    _render() {
        if (!this.$button) return;

        const supported = FipsDiscoveryProtocol.enabledFromConfig(this._config);
        this.$button.toggleAttribute("hidden", !supported);

        const translationKey = this._active
            ? "header.fips-discovery-disable"
            : "header.fips-discovery-enable";
        const iceBridgeSupported = globalThis.RuntimeCapabilities?.iceBridgeSupported?.(this._config, "fips")
            || globalThis.RuntimeCapabilities?.relayIceSupported?.(this._config, "fips");
        const signalingOnly = supported && !iceBridgeSupported
            ? " Signaling only: no FIPS instance ICE bridge descriptor is configured."
            : "";

        this.$button.title = this._connecting
            ? "Connecting to FIPS peer discovery"
            : `${Localization.getTranslation(`${translationKey}_title`)}${signalingOnly}`;
        this.$button.classList.toggle("selected", this._active);
        this.$button.classList.toggle("connecting", this._connecting);
        this.$button.classList.toggle("unavailable", supported && !this._available);
        this.$button.setAttribute("aria-busy", String(this._connecting));
        this.$button.setAttribute("aria-disabled", String(supported && !this._available));
        const userCount = globalThis.meshdropPeerAvailabilityCounts?.fips;
        if (this._active && !this._connecting) {
            this.$button.setAttribute("data-badge", String(typeof userCount === "number" ? userCount : 0));
        } else {
            this.$button.removeAttribute("data-badge");
        }
        Events.fire("footer-discovery-changed");
    }
}

globalThis.FipsDiscoveryController = FipsDiscoveryController;
