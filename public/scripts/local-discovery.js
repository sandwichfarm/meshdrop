/* eslint-disable no-undef */

const LocalDiscoveryProtocol = {
    storageKey: "meshdrop_local_discovery_enabled",

    readEnabled(storage = globalThis.localStorage) {
        const value = storage?.getItem?.(this.storageKey);
        return value !== "false";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    enabledFromConfig(config) {
        return globalThis.RuntimeCapabilities
            ? globalThis.RuntimeCapabilities.transportSupported(config, "localDiscovery", true)
            : true;
    }
};

globalThis.LocalDiscoveryProtocol = LocalDiscoveryProtocol;

class LocalDiscoveryController {

    constructor() {
        this.$button = $("local-discovery");
        this._enabled = LocalDiscoveryProtocol.readEnabled();
        this._supported = true;
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
        return this._supported && this._enabled;
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
        if (!this.isEnabled() || this._joined) return;
        this._joined = true;
        Events.fire("join-ip-room");
    }

    leave() {
        this._joined = false;
        Events.fire("leave-ip-room");
    }

    _onServerReady() {
        if (!this.isEnabled()) return;
        this.join();
    }

    _onConfig(config) {
        const wasSupported = this._supported;
        this._supported = LocalDiscoveryProtocol.enabledFromConfig(config);
        if (wasSupported && !this._supported) this.leave();
        this._render();
    }

    _render() {
        if (!this.$button) return;

        const userCount = globalThis.meshdropPeerAvailabilityCounts?.ip;
        this.$button.toggleAttribute("hidden", !this._supported);
        this.$button.classList.toggle("selected", this.isEnabled());
        this.$button.setAttribute("aria-pressed", String(this.isEnabled()));
        this.$button.title = this.isEnabled()
            ? "Same MeshDrop instance discovery enabled. WebRTC still chooses the best direct path when peers connect."
            : "Same MeshDrop instance discovery disabled.";
        if (this.isEnabled()) {
            this.$button.setAttribute("data-badge", String(typeof userCount === "number" ? userCount : 0));
        } else {
            this.$button.removeAttribute("data-badge");
        }
        Events.fire("footer-discovery-changed");
    }
}

globalThis.LocalDiscoveryController = LocalDiscoveryController;
