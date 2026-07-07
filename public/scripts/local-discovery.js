/* eslint-disable no-undef */

const LocalDiscoveryProtocol = {
    storageKey: "meshdrop_local_discovery_enabled",
    roomTypes: new Set(["ip"]),

    readEnabled(storage = globalThis.localStorage) {
        const value = storage?.getItem?.(this.storageKey);
        return value !== "false";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    localDiscoverySupportedFromConfig(config) {
        return globalThis.RuntimeCapabilities
            ? globalThis.RuntimeCapabilities.transportSupported(config, "localDiscovery", true)
            : true;
    },

    enabledFromConfig(config) {
        return this.localDiscoverySupportedFromConfig(config);
    },

    allowsRoomType(roomType, storage = globalThis.localStorage) {
        if (!this.roomTypes.has(roomType)) return true;
        return this.readEnabled(storage);
    }
};

globalThis.LocalDiscoveryProtocol = LocalDiscoveryProtocol;

const ClearnetRouteProtocol = {
    storageKey: "meshdrop_clearnet_routes_enabled",
    roomTypes: new Set(["nostr"]),

    readEnabled(storage = globalThis.localStorage) {
        const value = storage?.getItem?.(this.storageKey);
        return value !== "false";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    routeSupportedFromConfig(config) {
        if (!globalThis.RuntimeCapabilities) return true;
        return globalThis.RuntimeCapabilities.transportSupported(config, "nostr", true)
            && globalThis.RuntimeCapabilities.transportSupported(config, "webrtc", true);
    },

    allowsRoomType(roomType, storage = globalThis.localStorage) {
        if (!this.roomTypes.has(roomType)) return true;
        return this.readEnabled(storage);
    }
};

globalThis.ClearnetRouteProtocol = ClearnetRouteProtocol;

function renderProtocolToggle($button, hidden, enabled, title, badgeCount) {
    if (!$button) return;

    $button.toggleAttribute("hidden", hidden);
    $button.classList.toggle("selected", enabled);
    $button.setAttribute("aria-pressed", String(enabled));
    $button.title = title;
    if (enabled) {
        $button.setAttribute("data-badge", String(typeof badgeCount === "number" ? badgeCount : 0));
    } else {
        $button.removeAttribute("data-badge");
    }
    Events.fire("footer-discovery-changed");
}

class LocalDiscoveryController {

    constructor() {
        this.$button = $("local-discovery");
        this._enabled = LocalDiscoveryProtocol.readEnabled();
        this._localDiscoverySupported = true;
        this._routeSupported = true;
        this._joined = false;

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("display-name", _ => this._onServerReady());
        Events.on("config", e => this._onConfig(e.detail || {}));
        Events.on("ws-connected", _ => {
            this._joined = false;
            this._render();
        });
        Events.on("ws-disconnected", _ => {
            this._joined = false;
            this._render();
        });
        globalThis.meshdropLocalDiscovery = this;
    }

    isEnabled() {
        return this._routeSupported && this._enabled;
    }

    localDiscoveryEnabled() {
        return this._localDiscoverySupported && this._enabled;
    }

    toggle() {
        this.setEnabled(!this._enabled);
    }

    setEnabled(enabled) {
        this._enabled = !!enabled;
        LocalDiscoveryProtocol.writeEnabled(this._enabled);

        if (this._enabled) {
            this.join();
        }
        else {
            this.leave();
        }

        this._render();
    }

    join() {
        if (!this.localDiscoveryEnabled() || this._joined) return;
        this._joined = true;
        Events.fire("join-ip-room");
    }

    leave() {
        this._joined = false;
        Events.fire("leave-ip-room");
    }

    _onServerReady() {
        if (!this.localDiscoveryEnabled()) return;
        this.join();
    }

    _onConfig(config) {
        const wasLocalDiscoverySupported = this._localDiscoverySupported;
        this._localDiscoverySupported = LocalDiscoveryProtocol.localDiscoverySupportedFromConfig(config);
        this._routeSupported = this._localDiscoverySupported;
        if (wasLocalDiscoverySupported && !this._localDiscoverySupported) this.leave();
        this._render();
    }

    _render() {
        const enabled = this.isEnabled();
        const title = enabled
            ? "Instance sharing enabled. Auto selection may use peers on the same MeshDrop instance."
            : "Instance sharing disabled. File sharing skips peers discovered on this MeshDrop instance.";
        renderProtocolToggle(this.$button, !this._routeSupported, enabled, title, this._instancePeerCount());
    }

    _instancePeerCount() {
        const counts = globalThis.meshdropPeerAvailabilityCounts || {};
        return Number(counts.ip) || 0;
    }
}

globalThis.LocalDiscoveryController = LocalDiscoveryController;

class ClearnetRouteController {

    constructor() {
        this.$button = $("clearnet-routes");
        this._enabled = ClearnetRouteProtocol.readEnabled();
        this._routeSupported = true;

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => this._onConfig(e.detail || {}));
        globalThis.meshdropClearnetRoutes = this;
    }

    isEnabled() {
        return this._routeSupported && this._enabled;
    }

    toggle() {
        this.setEnabled(!this._enabled);
    }

    setEnabled(enabled) {
        this._enabled = !!enabled;
        ClearnetRouteProtocol.writeEnabled(this._enabled);
        Events.fire("clearnet-routes-changed", {enabled: this._enabled, roomTypes: ["nostr"]});
        this._render();
    }

    _onConfig(config) {
        this._routeSupported = ClearnetRouteProtocol.routeSupportedFromConfig(config);
        this._render();
    }

    _render() {
        const enabled = this.isEnabled();
        const title = enabled
            ? "Clearnet WebRTC routes enabled. Auto selection may use direct Internet WebRTC discovered by Nostr. Nostr discovery stays available when this is disabled."
            : "Clearnet WebRTC routes disabled. Nostr discovery stays available; file sharing skips direct Nostr-signaled Internet WebRTC.";
        renderProtocolToggle(this.$button, !this._routeSupported, enabled, title, globalThis.meshdropPeerAvailabilityCounts?.nostr);
    }
}

globalThis.ClearnetRouteController = ClearnetRouteController;
