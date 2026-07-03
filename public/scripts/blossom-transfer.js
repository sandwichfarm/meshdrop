const BlossomTransferProtocol = {
    authorizationKind: 24242,
    uploadExpirationSeconds: 10 * 60,

    serverUrlsFromConfig(config) {
        const servers = config?.blossom?.servers || [];
        return servers
            .map(server => server.trim())
            .filter(Boolean)
            .map(server => server.replace(/\/+$/, ""));
    },

    async sha256Hex(blob) {
        const buffer = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        return this.bytesToHex(new Uint8Array(digest));
    },

    bytesToHex(bytes) {
        return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
    },

    base64UrlEncode(value) {
        return btoa(value)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    },

    serverHost(serverUrl) {
        return new URL(serverUrl).host.toLowerCase();
    },

    createUploadAuthDraft({serverUrl, sha256, now = Math.floor(Date.now() / 1000)}) {
        return {
            kind: this.authorizationKind,
            created_at: now,
            tags: [
                ["t", "upload"],
                ["expiration", String(now + this.uploadExpirationSeconds)],
                ["server", this.serverHost(serverUrl)],
                ["x", sha256]
            ],
            content: "Upload Blob"
        };
    },

    authorizationHeader(event) {
        return `Nostr ${this.base64UrlEncode(JSON.stringify(event))}`;
    },

    validateDescriptor(descriptor, file, sha256) {
        if (!descriptor || typeof descriptor !== "object") throw new Error("Blossom descriptor is missing");
        if (descriptor.sha256 !== sha256) throw new Error("Blossom descriptor hash mismatch");
        if (Number(descriptor.size) !== file.size) throw new Error("Blossom descriptor size mismatch");
        if (!descriptor.url) throw new Error("Blossom descriptor URL is missing");

        return {
            url: descriptor.url,
            sha256: descriptor.sha256,
            size: Number(descriptor.size),
            type: descriptor.type || file.type || "application/octet-stream",
            uploaded: descriptor.uploaded || 0
        };
    }
};

globalThis.BlossomTransferProtocol = BlossomTransferProtocol;

class BlossomTransferController {

    constructor() {
        this.$button = $("blossom-transfer");
        this._active = false;
        this._config = {};

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => {
            this._config = e.detail || {};
            this._render();
        });
        Events.on("nostr-identity-changed", _ => {
            this.disable(false);
            this._render();
        });
        Events.on("nostr-server-list-changed", _ => this._render());
        Events.on("protocol-server-preferences-changed", _ => this._render());
        Events.on("nostr-signer-available-changed", _ => this._render());
        globalThis.meshdropBlossomTransfer = this;
    }

    toggle() {
        if (this._active) {
            this.disable();
            return;
        }

        this.enable();
    }

    enable() {
        if (!globalThis.meshdropNostrIdentity?.getIdentity()) {
            Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-identity-required"));
            return;
        }

        const serverState = this._serverListState();
        if (serverState.status === "loading") {
            Events.fire("notify-user", "Waiting for your Blossom server list from Nostr relays.");
            return;
        }

        if (serverState.status === "missing" || serverState.status === "error") {
            Events.fire("notify-user", "No Blossom server list was found for this Nostr identity.");
            return;
        }

        if (!this._serverUrls().length) {
            Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-server-required"));
            return;
        }

        this._active = true;
        this._render();
        Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-enabled"));
    }

    disable(notify = true) {
        if (!this._active) return;

        this._active = false;
        this._render();

        if (notify) {
            Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-disabled"));
        }
    }

    isActive() {
        return this._active;
    }

    async uploadFiles(files, onProgress = () => {}) {
        const serverUrl = this._serverUrls()[0];
        if (!serverUrl) throw new Error("No Blossom server configured");

        const descriptors = [];
        for (let i = 0; i < files.length; i++) {
            onProgress(0.8 * i / files.length);
            descriptors.push(await this.uploadFile(files[i], serverUrl));
        }
        onProgress(0.8);
        return descriptors;
    }

    async uploadFile(file, serverUrl) {
        const identityController = globalThis.meshdropNostrIdentity;
        const sha256 = await BlossomTransferProtocol.sha256Hex(file);
        const authDraft = BlossomTransferProtocol.createUploadAuthDraft({serverUrl, sha256});
        const authEvent = await identityController.signEvent(authDraft);
        const headers = {
            "Authorization": BlossomTransferProtocol.authorizationHeader(authEvent),
            "Content-Type": file.type || "application/octet-stream",
            "X-SHA-256": sha256
        };

        const response = await fetch(`${serverUrl}/upload`, {
            method: "PUT",
            headers,
            body: file
        });

        if (!response.ok) {
            throw new Error(response.headers.get("X-Reason") || `Blossom upload failed with ${response.status}`);
        }

        const descriptor = await response.json();
        return BlossomTransferProtocol.validateDescriptor(descriptor, file, sha256);
    }

    async downloadDescriptor(descriptor, header) {
        const response = await fetch(descriptor.url);
        if (!response.ok) throw new Error(`Blossom download failed with ${response.status}`);

        const blob = await response.blob();
        const sha256 = await BlossomTransferProtocol.sha256Hex(blob);
        if (sha256 !== descriptor.sha256) throw new Error("Blossom download hash mismatch");
        if (blob.size !== descriptor.size) throw new Error("Blossom download size mismatch");

        return new File([blob], header.name, {
            type: header.mime || descriptor.type || blob.type || "application/octet-stream"
        });
    }

    _serverUrls() {
        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        if (!identity) return BlossomTransferProtocol.serverUrlsFromConfig(this._config);

        return ProtocolServerPreferences.selectedServers("blossom", identity.blossomServers);
    }

    _serverListState() {
        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        if (!identity) return {status: "idle", servers: []};

        return {
            status: identity.blossomServerListStatus || "loading",
            servers: ProtocolServerPreferences.normalizeServers(identity.blossomServers)
        };
    }

    _render() {
        if (!this.$button) return;

        const identity = globalThis.meshdropNostrIdentity?.getIdentity();
        this.$button.toggleAttribute("hidden", !identity);
        if (!identity) return;

        const translationKey = this._active
            ? "header.blossom-transfer-disable"
            : "header.blossom-transfer-enable";

        const serverState = this._serverListState();
        const selectedCount = this._serverUrls().length;
        const unavailable = ["loading", "missing", "error"].includes(serverState.status);

        this.$button.title = this._titleForState(serverState.status)
            || Localization.getTranslation(`${translationKey}_title`);
        this.$button.classList.toggle("selected", this._active);
        this.$button.classList.toggle("loading", serverState.status === "loading");
        this.$button.classList.toggle("unavailable", unavailable);
        this.$button.setAttribute("aria-disabled", unavailable ? "true" : "false");
        this.$button.setAttribute("data-state", serverState.status);

        if (this._active && serverState.status === "found") {
            this.$button.setAttribute("data-badge", String(selectedCount));
        } else {
            this.$button.removeAttribute("data-badge");
        }
    }

    _titleForState(status) {
        if (status === "loading") return "Waiting for your Blossom server list from Nostr relays.";
        if (status === "missing") return "No Blossom server list was found for this Nostr identity.";
        if (status === "error") return "Blossom server list lookup failed.";
        return "";
    }
}

globalThis.BlossomTransferController = BlossomTransferController;
