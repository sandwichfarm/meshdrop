/* eslint-disable no-undef */

const PollenTransferProtocol = {
    statusPath: "pollen/status",
    uploadPath: "pollen/upload",
    downloadPath: "pollen/download",
    storageKey: "meshdrop_pollen_transfer_enabled",
    hashPattern: /^[0-9a-f]{64}$/i,
    pubkeyPattern: /^[0-9a-f]{64}$/i,
    instanceRelayPrimitive: "pollen-object-store",
    instanceRelayTtlMs: 10 * 60 * 1000,

    readEnabled(storage = globalThis.localStorage) {
        return storage?.getItem?.(this.storageKey) === "true";
    },

    writeEnabled(enabled, storage = globalThis.localStorage) {
        storage?.setItem?.(this.storageKey, enabled ? "true" : "false");
    },

    enabledFromConfig(config) {
        return globalThis.RuntimeCapabilities
            ? globalThis.RuntimeCapabilities.transportSupported(config, "pollen", !!config?.pollen?.enabled)
            : !!config?.pollen?.enabled;
    },

    summarizeStatus(status) {
        return {
            enabled: !!status?.enabled,
            available: !!status?.available,
            version: status?.version || "",
            error: status?.error || ""
        };
    },

    validateDescriptor(descriptor, file = null) {
        if (!descriptor || typeof descriptor !== "object") throw new Error("Pollen descriptor is missing");
        if (!this.hashPattern.test(descriptor.hash || "")) throw new Error("Pollen descriptor hash is invalid");
        if (!Number.isSafeInteger(Number(descriptor.size)) || Number(descriptor.size) < 0) {
            throw new Error("Pollen descriptor size is invalid");
        }
        if (file && Number(descriptor.size) !== file.size) throw new Error("Pollen descriptor size mismatch");

        return {
            hash: descriptor.hash.toLowerCase(),
            size: Number(descriptor.size),
            type: descriptor.type || file?.type || "application/octet-stream"
        };
    },

    endpoint(path) {
        const baseUrl = globalThis.__meshdropAndroidNativeBackend?.baseUrl;
        if (!baseUrl) return path;

        return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    },

    runtimeId() {
        return `browser:${globalThis.location?.host || "unknown"}`;
    },

    buildInstanceRelayDescriptor({
        ownerPubkey,
        sessionId,
        rooms = [],
        expiresAt = Date.now() + this.instanceRelayTtlMs,
        endpoint = {},
        runtimeId = this.runtimeId()
    } = {}) {
        if (!this.pubkeyPattern.test(ownerPubkey || "")) {
            throw new Error("Pollen instance relay owner pubkey is invalid");
        }
        if (!sessionId) throw new Error("Pollen instance relay session is missing");

        const descriptor = {
            version: 1,
            routeId: `pollen-instance-relay:${sessionId}`,
            routeType: "pollen",
            transportShape: "instance-relay",
            sessionId,
            ownerPubkey: ownerPubkey.toLowerCase(),
            expiresAt,
            endpoint: {
                primitive: this.instanceRelayPrimitive,
                uploadPath: this.uploadPath,
                downloadPath: this.downloadPath,
                rooms: [...new Set((rooms || []).filter(Boolean))],
                runtimeId,
                ...endpoint
            },
            overlayIdentity: {},
            constraints: {
                encrypted: true,
                private: true,
                fallback: false
            },
            capabilities: {
                instanceRelay: true,
                webRtcDataPath: false
            }
        };

        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, {
            expectedOwnerPubkey: descriptor.ownerPubkey,
            expectedSessionId: descriptor.sessionId,
            now: Date.now()
        });
        if (result && !result.ok) throw new Error(`Pollen instance relay descriptor rejected: ${result.reason}`);

        return descriptor;
    },

    buildInstanceRelayProofSeed({senderRuntime = this.runtimeId(), bytesSent = 0} = {}) {
        if (!senderRuntime) throw new Error("Pollen instance relay sender runtime is missing");
        if (!Number.isFinite(bytesSent) || bytesSent <= 0) {
            throw new Error("Pollen instance relay byte count is invalid");
        }

        return {
            senderRuntime,
            routeType: "pollen",
            dataPlanePrimitive: this.instanceRelayPrimitive,
            webRtcUsed: false,
            instanceRelayed: true,
            bytesSent,
            fallbackUsed: false
        };
    },

    validateInstanceRelayRequest(request = {}, {now = Date.now()} = {}) {
        const relay = request.pollenInstanceRelay || {};
        const descriptor = relay.descriptor;
        const proofSeed = relay.proofSeed || {};
        if (!descriptor) throw new Error("Pollen instance relay descriptor is missing");
        if (!proofSeed.senderRuntime) throw new Error("Pollen instance relay sender runtime is missing");
        if (proofSeed.fallbackUsed === true) throw new Error("Pollen instance relay fallback is forbidden");
        if (proofSeed.routeType !== "pollen") throw new Error("Pollen instance relay route type mismatch");
        if (proofSeed.dataPlanePrimitive !== this.instanceRelayPrimitive) {
            throw new Error("Pollen instance relay data-plane primitive mismatch");
        }
        if (proofSeed.webRtcUsed !== false) throw new Error("Pollen instance relay WebRTC byte path is forbidden");
        if (proofSeed.instanceRelayed !== true) throw new Error("Pollen instance relay flag is missing");

        const expectedOwnerPubkey = request.payloadEncryption?.keyDelivery?.senderPubkey;
        const expectedSessionId = request.payloadEncryption?.transferId;
        if (!this.pubkeyPattern.test(expectedOwnerPubkey || "")) {
            throw new Error("Pollen instance relay owner binding is missing");
        }
        if (!expectedSessionId) {
            throw new Error("Pollen instance relay session binding is missing");
        }
        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, {
            expectedOwnerPubkey,
            expectedSessionId,
            now
        });
        if (!result?.ok) {
            const reason = result?.reason || "invalid-descriptor";
            if (reason === "session-mismatch") throw new Error("Pollen instance relay session mismatch");
            if (reason === "owner-mismatch") throw new Error("Pollen instance relay owner mismatch");
            if (reason === "expired") throw new Error("Pollen instance relay descriptor expired");
            throw new Error(`Pollen instance relay descriptor rejected: ${reason}`);
        }
        if (result.descriptor.routeType !== "pollen") throw new Error("Pollen instance relay descriptor route mismatch");
        if (result.descriptor.transportShape !== "instance-relay") {
            throw new Error("Pollen instance relay descriptor shape mismatch");
        }
        if (result.descriptor.endpoint?.primitive !== this.instanceRelayPrimitive) {
            throw new Error("Pollen instance relay descriptor primitive mismatch");
        }

        return {
            descriptor: result.descriptor,
            proofSeed: {...proofSeed}
        };
    },

    async payloadHashMatched(request = {}, decryptedFiles = []) {
        const integrity = request.payloadIntegrity;
        if (integrity?.algorithm !== "SHA-256" || !Array.isArray(integrity.files)) {
            throw new Error("Pollen instance relay payload integrity is missing");
        }
        if (!globalThis.BlossomTransferProtocol?.sha256Hex) {
            throw new Error("Pollen instance relay hash verification is unavailable");
        }

        for (const entry of integrity.files) {
            const file = decryptedFiles[entry.index];
            if (!file) throw new Error("Pollen instance relay decrypted file is missing");
            const actual = await globalThis.BlossomTransferProtocol.sha256Hex(file);
            if (actual !== entry.sha256) throw new Error("Pollen instance relay hash mismatch");
        }

        return true;
    },

    async finalizeInstanceRelayProof({
        request,
        encryptedFiles = [],
        decryptedFiles = [],
        recipientRuntime = this.runtimeId(),
        now = Date.now()
    } = {}) {
        const relay = this.validateInstanceRelayRequest(request, {now});
        if (!recipientRuntime) throw new Error("Pollen instance relay recipient runtime is missing");
        const bytesReceived = encryptedFiles.reduce((total, file) => total + Number(file?.size || 0), 0);
        const hashMatched = await this.payloadHashMatched(request, decryptedFiles);
        const proof = {
            ...relay.proofSeed,
            recipientRuntime,
            bytesReceived,
            hashMatched
        };
        const result = globalThis.MeshDropRouteContract?.validateRouteProof?.(proof);
        if (!result?.ok) {
            throw new Error(`Pollen instance relay proof rejected: ${result?.reason || "invalid-proof"}`);
        }

        return result.proof;
    }
};

globalThis.PollenTransferProtocol = PollenTransferProtocol;

class PollenTransferController {

    constructor() {
        this.$button = $("pollen-transfer");
        this._active = false;
        this._config = {};
        this._lastStatus = null;
        this._available = false;
        this._connecting = false;
        this._preferredActive = PollenTransferProtocol.readEnabled();

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        Events.on("config", e => this._onConfig(e.detail || {}));
        Events.on("pollen-status", e => this._onStatus(e.detail));
        Events.on("ws-disconnected", _ => {
            this._active = false;
            this._connecting = false;
            this._render();
        });
        globalThis.meshdropPollenTransfer = this;
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
        if (!PollenTransferProtocol.enabledFromConfig(this._config)) {
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.pollen-transfer-server-required"));
            return;
        }

        this._connecting = true;
        this._render();

        let status;
        try {
            status = await this.fetchStatus();
        } catch {
            status = {available: false};
        }

        this._connecting = false;
        if (!status.available) {
            this._active = false;
            this._render();
            if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.pollen-transfer-unavailable"));
            return;
        }

        this._active = true;
        this._render();
        if (remember) this._setPreferredActive(true);
        Events.fire("join-pollen-room", {rooms: await this._runtimeRooms({pairwise: false})});
        if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.pollen-transfer-enabled"));
    }

    disable(notify = true, remember = notify) {
        if (!this._active && !this._connecting) return;

        this._active = false;
        this._connecting = false;
        this._render();
        Events.fire("leave-pollen-room");

        if (remember) this._setPreferredActive(false);
        if (notify) Events.fire("notify-user", Localization.getTranslation("notifications.pollen-transfer-disabled"));
    }

    _onStatus(status) {
        const summary = PollenTransferProtocol.summarizeStatus(status);
        this._lastStatus = summary;
        this._available = summary.available;
        this._connecting = false;
        this._active = summary.available;
        this._render();

        if (!summary.available) {
            Events.fire("notify-user", Localization.getTranslation("notifications.pollen-transfer-unavailable"));
        }
    }

    isActive() {
        return this._active;
    }

    async fetchStatus() {
        const response = await fetch(PollenTransferProtocol.endpoint(PollenTransferProtocol.statusPath));
        if (!response.ok) throw new Error(`Pollen status failed with ${response.status}`);

        const status = PollenTransferProtocol.summarizeStatus(await response.json());
        this._lastStatus = status;
        this._available = status.available;
        this._render();
        return status;
    }

    async uploadFiles(files, onProgress = () => {}) {
        const descriptors = [];
        for (let i = 0; i < files.length; i++) {
            onProgress(0.8 * i / files.length);
            descriptors.push(await this.uploadFile(files[i]));
        }
        onProgress(0.8);
        return descriptors;
    }

    async uploadFile(file) {
        const response = await fetch(PollenTransferProtocol.endpoint(PollenTransferProtocol.uploadPath), {
            method: "POST",
            headers: {
                "Content-Type": file.type || "application/octet-stream"
            },
            body: file
        });

        if (!response.ok) {
            const error = await response.json().catch(_ => ({}));
            throw new Error(error.error || `Pollen upload failed with ${response.status}`);
        }

        return PollenTransferProtocol.validateDescriptor(await response.json(), file);
    }

    async downloadDescriptor(descriptor, header) {
        const pollenDescriptor = PollenTransferProtocol.validateDescriptor(descriptor);
        const response = await fetch(PollenTransferProtocol.endpoint(`${PollenTransferProtocol.downloadPath}/${pollenDescriptor.hash}`));
        if (!response.ok) {
            const error = await response.json().catch(_ => ({}));
            throw new Error(error.error || `Pollen download failed with ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size !== pollenDescriptor.size) throw new Error("Pollen download size mismatch");

        return new File([blob], header.name, {
            type: header.mime || pollenDescriptor.type || blob.type || "application/octet-stream"
        });
    }

    async _onConfig(config) {
        this._config = config;
        this._available = false;
        this._render();

        if (!PollenTransferProtocol.enabledFromConfig(config)) return;

        try {
            await this.fetchStatus();
        } catch {
            this._available = false;
            this._render();
        }

        await this._restorePreferredActive();
    }

    _setPreferredActive(enabled) {
        this._preferredActive = !!enabled;
        PollenTransferProtocol.writeEnabled(this._preferredActive);
    }

    async _restorePreferredActive() {
        if (!this._preferredActive || this._active || this._connecting) return;
        if (!PollenTransferProtocol.enabledFromConfig(this._config) || !this._available) return;

        await this.enable({notify: false, remember: false});
    }

    async routeDescriptorFor(peerPubkey) {
        if (!this._active || !this._available) return null;

        const identityController = globalThis.meshdropNostrIdentity;
        const identity = identityController?.getIdentity?.();
        if (!identity?.pubkey || !globalThis.NpubNetworkProtocol?.pairwiseRoom) return null;

        const pairwiseRoom = await globalThis.NpubNetworkProtocol.pairwiseRoom(identity.pubkey, peerPubkey);
        const rooms = [pairwiseRoom].filter(Boolean);
        const explicitRoom = this._config?.pollen?.discoveryMode === "public"
            ? globalThis.NpubNetworkProtocol.normalizeRoom(this._config?.pollen?.room)
            : "";
        if (explicitRoom) rooms.push(explicitRoom);

        return {
            routeType: "pollen",
            rooms: [...new Set(rooms)]
        };
    }

    joinRouteDescriptor(descriptor = {}) {
        if (!this._active || !this._available) return false;
        const rooms = [...new Set((descriptor.rooms || [])
            .map(room => globalThis.NpubNetworkProtocol?.normalizeRoom?.(room) || "")
            .filter(Boolean))];
        if (!rooms.length) return false;

        Events.fire("join-pollen-room", {rooms});
        return true;
    }

    async _runtimeRooms(options = {}) {
        const identityController = globalThis.meshdropNostrIdentity;
        const identity = await identityController?.ensureFollowListLoaded?.()
            || identityController?.getIdentity?.();
        return globalThis.NpubNetworkProtocol?.roomsForIdentity
            ? globalThis.NpubNetworkProtocol.roomsForIdentity(identity, {
                room: this._config?.pollen?.room,
                discoveryMode: this._config?.pollen?.discoveryMode,
                pairwise: options.pairwise !== false
            })
            : [];
    }

    _render() {
        if (!this.$button) return;

        const supported = PollenTransferProtocol.enabledFromConfig(this._config);
        this.$button.toggleAttribute("hidden", !supported);

        const translationKey = this._active
            ? "header.pollen-transfer-disable"
            : "header.pollen-transfer-enable";
        const signalingOnly = supported && !globalThis.RuntimeCapabilities?.relayIceSupported?.(this._config, "pollen")
            ? " Signaling only: no Pollen WebRTC relay ICE is configured."
            : "";

        this.$button.title = this._connecting
            ? "Checking Pollen daemon"
            : `${Localization.getTranslation(`${translationKey}_title`)}${signalingOnly}`;
        this.$button.classList.toggle("selected", this._active);
        this.$button.classList.toggle("connecting", this._connecting);
        this.$button.classList.toggle("unavailable", supported && !this._available);
        this.$button.setAttribute("aria-busy", String(this._connecting));
        this.$button.setAttribute("aria-disabled", String(supported && !this._available));
        const userCount = globalThis.meshdropPeerAvailabilityCounts?.pollen;
        if (supported && !this._connecting) {
            this.$button.setAttribute("data-badge", String(typeof userCount === "number" ? userCount : 0));
        } else {
            this.$button.removeAttribute("data-badge");
        }
        Events.fire("footer-discovery-changed");
    }
}

globalThis.PollenTransferController = PollenTransferController;
