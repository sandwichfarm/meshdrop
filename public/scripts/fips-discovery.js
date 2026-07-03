const FipsDiscoveryProtocol = {
    statusPath: "fips/status",

    roomFromConfig(config) {
        return config?.fips?.room || "meshdrop-fips";
    },

    enabledFromConfig(config) {
        return !!config?.fips?.enabled;
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
            room: status.room || "meshdrop-fips"
        };
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

    async enable() {
        if (!FipsDiscoveryProtocol.enabledFromConfig(this._config)) {
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-server-required"));
            return;
        }

        this._connecting = true;
        this._render();

        let status;
        try {
            status = await this.fetchStatus();
        } catch {
            this._connecting = false;
            this._available = false;
            this._render();
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-unavailable"));
            return;
        }

        if (!status.available) {
            this._connecting = false;
            this._available = false;
            this._render();
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-unavailable"));
            return;
        }

        Events.fire("join-fips-room");
    }

    disable(notify = true) {
        if (!this._active && !this._connecting) return;

        this._active = false;
        this._connecting = false;
        this._render();
        Events.fire("leave-fips-room");

        if (notify) {
            Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-disabled"));
        }
    }

    isActive() {
        return this._active;
    }

    async fetchStatus() {
        const response = await fetch(FipsDiscoveryProtocol.statusPath);
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
        Events.fire("notify-user", Localization.getTranslation("notifications.fips-discovery-enabled"));
    }

    _render() {
        if (!this.$button) return;

        const canUseFips = FipsDiscoveryProtocol.enabledFromConfig(this._config) && this._available;
        this.$button.toggleAttribute("hidden", !canUseFips);

        const translationKey = this._active
            ? "header.fips-discovery-disable"
            : "header.fips-discovery-enable";

        this.$button.title = this._connecting
            ? "Connecting to FIPS peer discovery"
            : Localization.getTranslation(`${translationKey}_title`);
        this.$button.classList.toggle("selected", this._active);
        this.$button.classList.toggle("connecting", this._connecting);
        this.$button.setAttribute("aria-busy", String(this._connecting));
        const userCount = globalThis.meshdropPeerAvailabilityCounts?.fips;
        if (this._active && !this._connecting) {
            this.$button.setAttribute("data-badge", String(typeof userCount === "number" ? userCount : 0));
        } else {
            this.$button.removeAttribute("data-badge");
        }
    }
}

globalThis.FipsDiscoveryController = FipsDiscoveryController;
