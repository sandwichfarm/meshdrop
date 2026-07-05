/* eslint-disable no-undef */

const blossomTransferScriptSrc = (() => {
    try {
        return globalThis.document?.currentScript?.src
            || globalThis.document?.querySelector?.('script[src$="scripts/blossom-transfer.js"]')?.src
            || "";
    } catch {
        return "";
    }
})();

const BlossomTransferProtocol = {
    authorizationKind: 24242,
    uploadExpirationSeconds: 10 * 60,
    encryptionVersion: "BLOSSOM-E2EE-01",
    keyEnvelopeVersion: "BLOSSOM-KEY-01",
    contentAlgorithm: "AES-256-GCM",
    storageKey: "meshdrop_blossom_transfer_enabled",

    readEnabled(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) === "true";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    enabledFromConfig(config) {
        return globalThis.RuntimeCapabilities
            ? globalThis.RuntimeCapabilities.transportSupported(config, "blossom", true)
            : true;
    },

    serverUrlsFromConfig(config) {
        const servers = config?.blossom?.servers || [];
        return servers
            .map(server => server.trim())
            .filter(Boolean)
            .map(server => server.replace(/\/+$/, ""));
    },

    hasWebCrypto() {
        return !!(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
    },

    hasSubtleCrypto() {
        return !!globalThis.crypto?.subtle;
    },

    webCrypto() {
        if (!this.hasWebCrypto()) {
            throw new Error("Encrypted Blossom transfers require Web Crypto. Open MeshDrop over HTTPS or localhost.");
        }

        return globalThis.crypto;
    },

    async sha256Hex(blob) {
        const buffer = await blob.arrayBuffer();
        const digest = await this.webCrypto().subtle.digest("SHA-256", buffer);
        return this.bytesToHex(new Uint8Array(digest));
    },

    async sha256HexForEncryptedDownload(blob) {
        const buffer = await blob.arrayBuffer();

        if (this.hasSubtleCrypto()) {
            const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
            return this.bytesToHex(new Uint8Array(digest));
        }

        try {
            const sha256 = await this.fallbackSha256();
            return this.bytesToHex(sha256(new Uint8Array(buffer)));
        } catch (error) {
            throw new Error(
                `Blossom encrypted download requires Web Crypto or bundled SHA-256 fallback: ${error.message}`
            );
        }
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

    bytesToBase64Url(bytes) {
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode(...bytes.slice(i, i + 0x8000));
        }
        return this.base64UrlEncode(binary);
    },

    base64UrlToBytes(value) {
        if (typeof value !== "string" || !value) throw new Error("Base64url value is missing");

        const base64 = value
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
        return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    },

    randomBytes(size) {
        const bytes = new Uint8Array(size);
        this.webCrypto().getRandomValues(bytes);
        return bytes;
    },

    createTransferId() {
        return this.bytesToBase64Url(this.randomBytes(16));
    },

    async generateContentKey() {
        return this.webCrypto().subtle.generateKey(
            {name: "AES-GCM", length: 256},
            true,
            ["encrypt", "decrypt"]
        );
    },

    async exportContentKey(contentKey) {
        return new Uint8Array(await this.webCrypto().subtle.exportKey("raw", contentKey));
    },

    async importContentKey(rawKey) {
        return this.webCrypto().subtle.importKey(
            "raw",
            rawKey,
            {name: "AES-GCM"},
            false,
            ["encrypt", "decrypt"]
        );
    },

    async importContentKeyForDecrypt(rawKey) {
        if (!(rawKey instanceof Uint8Array) || rawKey.length !== 32) {
            throw new Error("Blossom AES-256-GCM key is invalid");
        }

        if (!this.hasSubtleCrypto()) return {rawKey};

        return {
            rawKey,
            cryptoKey: await globalThis.crypto.subtle.importKey(
                "raw",
                rawKey,
                {name: "AES-GCM"},
                false,
                ["decrypt"]
            )
        };
    },

    fileAad({transferId, index, header}) {
        return new TextEncoder().encode(JSON.stringify({
            version: this.encryptionVersion,
            transferId,
            index,
            name: header?.name || "",
            mime: header?.mime || "",
            size: Number(header?.size) || 0
        }));
    },

    async encryptFile(file, contentKey, {transferId, index, header}) {
        const iv = this.randomBytes(12);
        const ciphertext = await this.webCrypto().subtle.encrypt({
            name: "AES-GCM",
            iv,
            additionalData: this.fileAad({transferId, index, header}),
            tagLength: 128
        }, contentKey, await file.arrayBuffer());

        return {
            blob: new Blob([ciphertext], {type: "application/octet-stream"}),
            envelope: {
                index,
                iv: this.bytesToBase64Url(iv),
                tagLength: 128
            }
        };
    },

    async decryptFile(blob, contentKey, {transferId, index, header, fileEnvelope}) {
        if (!fileEnvelope || fileEnvelope.index !== index) throw new Error("Blossom encryption file envelope mismatch");

        const data = await blob.arrayBuffer();
        const iv = this.base64UrlToBytes(fileEnvelope.iv);
        const aad = this.fileAad({transferId, index, header});
        const tagLength = fileEnvelope.tagLength || 128;
        let plaintext;

        if (this.hasSubtleCrypto()) {
            const cryptoKey = contentKey?.cryptoKey
                || (contentKey instanceof Uint8Array
                    ? await globalThis.crypto.subtle.importKey("raw", contentKey, {name: "AES-GCM"}, false, ["decrypt"])
                    : contentKey);
            plaintext = await globalThis.crypto.subtle.decrypt({
                name: "AES-GCM",
                iv,
                additionalData: aad,
                tagLength
            }, cryptoKey, data);
        } else {
            plaintext = await this.decryptFileWithFallback({
                rawKey: contentKey?.rawKey || contentKey,
                iv,
                aad,
                ciphertextWithTag: new Uint8Array(data),
                tagLength
            });
        }

        if (plaintext.byteLength !== header.size) throw new Error("Blossom plaintext size mismatch");

        return new File([plaintext], header.name, {
            type: header.mime || "application/octet-stream"
        });
    },

    async decryptFileWithFallback({rawKey, iv, aad, ciphertextWithTag, tagLength}) {
        if (!(rawKey instanceof Uint8Array) || rawKey.length !== 32) {
            throw new Error("Blossom encrypted download requires raw AES-256 key bytes for JS fallback");
        }
        if (tagLength !== 128) throw new Error("Blossom fallback decrypt requires AES-GCM 128-bit tag");

        try {
            const aesGcm = await this.fallbackAesGcm();
            return aesGcm(rawKey, iv, aad).decrypt(ciphertextWithTag);
        } catch (error) {
            if (/Blossom encrypted download requires/.test(error.message)) throw error;
            if (/invalid ghash tag|invalid tag|tag/i.test(error.message)) {
                throw new Error("Blossom encrypted download authentication failed");
            }
            throw new Error(`Blossom encrypted download fallback failed: ${error.message}`);
        }
    },

    fallbackModuleUrl(relativePath) {
        if (globalThis.meshdropBlossomFallbackBaseUrl) {
            return new URL(relativePath, globalThis.meshdropBlossomFallbackBaseUrl).href;
        }
        if (blossomTransferScriptSrc) {
            return new URL(relativePath, blossomTransferScriptSrc).href;
        }
        return relativePath;
    },

    async fallbackAesGcm() {
        if (globalThis.meshdropBlossomAesGcmFallback) {
            return globalThis.meshdropBlossomAesGcmFallback();
        }

        const module = await import(this.fallbackModuleUrl("libs/noble-ciphers/aes.js"));
        return module.gcm;
    },

    async fallbackSha256() {
        if (globalThis.meshdropBlossomSha256Fallback) {
            return globalThis.meshdropBlossomSha256Fallback();
        }

        const module = await import(this.fallbackModuleUrl("libs/noble-hashes/sha2.js"));
        return module.sha256;
    },

    validateEncryptionEnvelope(envelope, headers = []) {
        if (!envelope || typeof envelope !== "object") throw new Error("Blossom encryption envelope is missing");
        if (envelope.version !== this.encryptionVersion) throw new Error("Unsupported Blossom encryption envelope version");
        if (envelope.algorithm !== this.contentAlgorithm) throw new Error("Unsupported Blossom encryption algorithm");
        if (!envelope.transferId) throw new Error("Blossom encryption transfer id is missing");
        if (!Array.isArray(envelope.files) || envelope.files.length !== headers.length) {
            throw new Error("Blossom encryption file envelope mismatch");
        }
        if (!envelope.keyDelivery || typeof envelope.keyDelivery !== "object") {
            throw new Error("Blossom encryption key delivery is missing");
        }
        return envelope;
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
        this._preferredActive = BlossomTransferProtocol.readEnabled();

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => {
            this._config = e.detail || {};
            if (!BlossomTransferProtocol.enabledFromConfig(this._config)) this.disable(false, false);
            this._render();
            if (BlossomTransferProtocol.enabledFromConfig(this._config)) this._restorePreferredActive();
        });
        Events.on("nostr-identity-changed", _ => {
            this.disable(false, false);
            this._render();
            this._restorePreferredActive();
        });
        Events.on("nostr-server-list-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        Events.on("protocol-server-preferences-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        Events.on("nostr-signer-available-changed", _ => {
            this._render();
            this._restorePreferredActive();
        });
        globalThis.meshdropBlossomTransfer = this;
        this._restorePreferredActive();
    }

    toggle() {
        if (this._active) {
            this.disable();
            return;
        }

        this.enable();
    }

    enable({notify = true, remember = true} = {}) {
        if (!BlossomTransferProtocol.enabledFromConfig(this._config)) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-runtime-unsupported"));
            return;
        }

        if (!globalThis.meshdropNostrIdentity?.getIdentity()) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-identity-required"));
            return;
        }

        if (!BlossomTransferProtocol.hasWebCrypto()) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-webcrypto-required"));
            return;
        }

        const serverState = this._serverListState();
        if (serverState.status === "loading") {
            if (notify) Events.fire("notify-user", "Waiting for your Blossom server list from Nostr relays.");
            return;
        }

        if (serverState.status === "missing" || serverState.status === "error") {
            if (notify) Events.fire("notify-user", "No Blossom server list was found for this Nostr identity.");
            return;
        }

        if (!this._serverUrls().length) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-server-required"));
            return;
        }

        this._active = true;
        this._render();
        if (remember) this._setPreferredActive(true);
        if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-enabled"));
    }

    disable(notify = true, remember = notify) {
        if (!this._active) return;

        this._active = false;
        this._render();

        if (remember) this._setPreferredActive(false);
        if (notify) {
            Events.fire("notify-user", Localization.getTranslation("notifications.blossom-transfer-disabled"));
        }
    }

    isActive() {
        return this._active;
    }

    _setPreferredActive(enabled) {
        this._preferredActive = !!enabled;
        BlossomTransferProtocol.writeEnabled(this._preferredActive);
    }

    _restorePreferredActive() {
        if (!this._preferredActive || this._active) return;

        this.enable({notify: false, remember: false});
    }

    async uploadFiles() {
        throw new Error("Raw Blossom uploads require end-to-end encryption");
    }

    async uploadEncryptedFiles(files, headers, contentKey, onProgress = () => {}) {
        const serverUrl = this._serverUrls()[0];
        if (!serverUrl) throw new Error("No Blossom server configured");
        if (!contentKey) throw new Error("Blossom encryption key is missing");

        const transferId = BlossomTransferProtocol.createTransferId();
        const descriptors = [];
        const fileEnvelopes = [];
        for (let i = 0; i < files.length; i++) {
            onProgress(0.8 * i / files.length);
            const encrypted = await BlossomTransferProtocol.encryptFile(files[i], contentKey, {
                transferId,
                index: i,
                header: headers[i]
            });
            descriptors.push(await this.uploadFile(encrypted.blob, serverUrl));
            fileEnvelopes.push(encrypted.envelope);
        }
        onProgress(0.8);
        return {
            blossomDescriptors: descriptors,
            blossomEncryption: {
                version: BlossomTransferProtocol.encryptionVersion,
                algorithm: BlossomTransferProtocol.contentAlgorithm,
                transferId,
                files: fileEnvelopes
            }
        };
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

    async downloadDescriptor(descriptor, header, encryption = null) {
        const response = await fetch(descriptor.url);
        if (!response.ok) throw new Error(`Blossom download failed with ${response.status}`);

        const blob = await response.blob();
        const sha256 = encryption
            ? await BlossomTransferProtocol.sha256HexForEncryptedDownload(blob)
            : await BlossomTransferProtocol.sha256Hex(blob);
        if (sha256 !== descriptor.sha256) throw new Error("Blossom download hash mismatch");
        if (blob.size !== descriptor.size) throw new Error("Blossom download size mismatch");

        if (encryption) {
            return BlossomTransferProtocol.decryptFile(blob, encryption.contentKey, {
                transferId: encryption.envelope.transferId,
                index: encryption.index,
                header,
                fileEnvelope: encryption.envelope.files[encryption.index]
            });
        }

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
        const supported = BlossomTransferProtocol.enabledFromConfig(this._config);
        this.$button.toggleAttribute("hidden", !identity || !supported);
        if (!identity || !supported) return;

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
