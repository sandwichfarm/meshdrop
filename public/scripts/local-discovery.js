/* eslint-disable no-undef */

const LocalDiscoveryProtocol = {
    storageKey: "meshdrop_local_discovery_enabled",
    clearnetRoomTypes: new Set(["ip", "nostr"]),

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

    nostrClearnetRouteSupportedFromConfig(config) {
        if (!globalThis.RuntimeCapabilities) return true;
        return globalThis.RuntimeCapabilities.transportSupported(config, "nostr", true)
            && globalThis.RuntimeCapabilities.transportSupported(config, "webrtc", true);
    },

    clearnetRouteSupportedFromConfig(config) {
        return this.localDiscoverySupportedFromConfig(config)
            || this.nostrClearnetRouteSupportedFromConfig(config);
    },

    enabledFromConfig(config) {
        return this.localDiscoverySupportedFromConfig(config);
    },

    allowsRoomType(roomType, storage = globalThis.localStorage) {
        if (!this.clearnetRoomTypes.has(roomType)) return true;
        return this.readEnabled(storage);
    }
};

globalThis.LocalDiscoveryProtocol = LocalDiscoveryProtocol;

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

        Events.fire("clearnet-routes-changed", {enabled: this._enabled});
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
        this._routeSupported = LocalDiscoveryProtocol.clearnetRouteSupportedFromConfig(config);
        if (wasLocalDiscoverySupported && !this._localDiscoverySupported) this.leave();
        this._render();
    }

    _render() {
        if (!this.$button) return;

        const userCount = this._clearnetPeerCount();
        this.$button.toggleAttribute("hidden", !this._routeSupported);
        this.$button.classList.toggle("selected", this.isEnabled());
        this.$button.setAttribute("aria-pressed", String(this.isEnabled()));
        this.$button.title = this.isEnabled()
            ? "Clearnet file routes enabled. Auto selection may use same-instance or direct Nostr-signaled WebRTC when available."
            : "Clearnet routes disabled. Nostr discovery stays available; file sharing skips same-instance and direct Nostr-signaled WebRTC.";
        if (this.isEnabled()) {
            this.$button.setAttribute("data-badge", String(typeof userCount === "number" ? userCount : 0));
        } else {
            this.$button.removeAttribute("data-badge");
        }
        Events.fire("footer-discovery-changed");
    }

    _clearnetPeerCount() {
        const counts = globalThis.meshdropPeerAvailabilityCounts || {};
        return (Number(counts.ip) || 0) + (Number(counts.nostr) || 0);
    }
}

globalThis.LocalDiscoveryController = LocalDiscoveryController;
