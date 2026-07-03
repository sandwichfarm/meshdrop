const LocalDiscoveryProtocol = {
    storageKey: "meshdrop_local_discovery_enabled",

    readEnabled(storage = globalThis.localStorage) {
        const value = storage?.getItem?.(this.storageKey);
        return value !== "false";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    }
};

globalThis.LocalDiscoveryProtocol = LocalDiscoveryProtocol;

class LocalDiscoveryController {

    constructor() {
        this.$button = $("local-discovery");
        this._enabled = LocalDiscoveryProtocol.readEnabled();
        this._joined = false;

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("display-name", _ => this._onDisplayName());
        Events.on("ws-connected", _ => this._onDisplayName());
        Events.on("ws-disconnected", _ => {
            this._joined = false;
            this._render();
        });
        globalThis.meshdropLocalDiscovery = this;
    }

    isEnabled() {
        return this._enabled;
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
        if (!this._enabled || this._joined) return;
        this._joined = true;
        Events.fire("join-ip-room");
    }

    leave() {
        if (!this._joined) return;
        this._joined = false;
        Events.fire("leave-ip-room");
    }

    _onDisplayName() {
        if (!this._enabled) return;
        this.join();
    }

    _render() {
        if (!this.$button) return;

        this.$button.classList.toggle("selected", this._enabled);
        this.$button.setAttribute("aria-pressed", String(this._enabled));
        this.$button.title = this._enabled
            ? "Local network discovery enabled"
            : "Local network discovery disabled";
    }
}

globalThis.LocalDiscoveryController = LocalDiscoveryController;
