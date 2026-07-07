const AndroidNativeRouteProtocol = {
    uploadPath: "pollen/upload",
    downloadPath: "pollen/download",
    statusPaths: {
        fips: "fips/status",
        pollen: "pollen/status"
    },
    hashPattern: /^[0-9a-f]{64}$/i,

    backend() {
        return globalThis.__meshdropAndroidNativeBackend || {};
    },

    baseUrl() {
        const backend = this.backend();
        return backend.alive === true && typeof backend.baseUrl === "string" ? backend.baseUrl : "";
    },

    endpoint(path) {
        const baseUrl = this.baseUrl();
        if (!baseUrl) throw new Error("Android native backend is unavailable");
        return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    },

    runtimeId() {
        const baseUrl = this.baseUrl();
        if (!baseUrl) return "android-webview:native-unavailable";
        try {
            return `android-webview:${new URL(baseUrl).host}`;
        } catch {
            return "android-webview:native-loopback";
        }
    },

    pollenPrimitive(status = null) {
        return status?.backend === "android-native-pln" ? "android-native-pln" : "android-native-object-store";
    },

    fipsPrimitive(status = null) {
        return status?.backend === "android-native-fipsctl" ? "android-native-fipsctl" : "android-native-fips-status";
    },

    validateObjectDescriptor(descriptor, file = null) {
        if (!descriptor || typeof descriptor !== "object") throw new Error("Android native Pollen descriptor is missing");
        if (!this.hashPattern.test(descriptor.hash || "")) throw new Error("Android native Pollen descriptor hash is invalid");
        const size = Number(descriptor.size);
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new Error("Android native Pollen descriptor size is invalid");
        }
        if (file && size !== file.size) throw new Error("Android native Pollen descriptor size mismatch");

        return {
            hash: descriptor.hash.toLowerCase(),
            size,
            type: descriptor.type || file?.type || "application/octet-stream",
            name: descriptor.name || file?.name || "meshdrop-android-native-object"
        };
    },

    async hashFile(file) {
        const body = await file.arrayBuffer();
        const digest = await globalThis.crypto.subtle.digest("SHA-256", body);
        return [...new Uint8Array(digest)]
            .map(value => value.toString(16).padStart(2, "0"))
            .join("");
    },

    async fetchJson(path) {
        const response = await fetch(this.endpoint(path));
        if (!response.ok) throw new Error(`Android native backend ${path} failed: ${response.status}`);
        return response.json();
    }
};

class AndroidNativeRouteAdapter {

    constructor(protocol = AndroidNativeRouteProtocol) {
        this.protocol = protocol;
        this._fipsStatus = null;
        this._pollenStatus = null;
        this._lastSend = null;
        this._lastProof = null;
    }

    status() {
        if (!this.protocol.baseUrl()) {
            return {
                supported: false,
                available: false,
                reason: "android-native-backend-unavailable"
            };
        }
        if (this._pollenStatus && this._pollenStatus.available !== true) {
            return {
                supported: true,
                available: false,
                reason: this._pollenStatus.error || "android-native-pollen-unavailable",
                fipsStatus: this._fipsStatus,
                pollenStatus: this._pollenStatus
            };
        }

        return {
            supported: true,
            available: true,
            reason: "",
            backendBaseUrl: this.protocol.baseUrl(),
            fipsStatus: this._fipsStatus,
            pollenStatus: this._pollenStatus
        };
    }

    capabilities() {
        if (!this.protocol.baseUrl()) return [];

        const capabilities = [];
        if (!this._pollenStatus || this._pollenStatus.available === true) {
            capabilities.push({
                routeType: "pollen",
                transportShape: "object-store",
                dataPlanePrimitive: this.protocol.pollenPrimitive(this._pollenStatus),
                nativeBridgeAvailable: true,
                transferSupported: true
            });
        }
        if (this._fipsStatus?.available === true) {
            capabilities.push({
                routeType: "fips",
                transportShape: "stream",
                dataPlanePrimitive: this.protocol.fipsPrimitive(this._fipsStatus),
                nativeBridgeAvailable: true,
                transferSupported: false,
                statusOnly: true
            });
        }

        return capabilities;
    }

    async refreshStatus() {
        if (!this.protocol.baseUrl()) return this.status();

        const [pollenStatus, fipsStatus] = await Promise.all([
            this._fetchStatus("pollen"),
            this._fetchStatus("fips")
        ]);
        this._pollenStatus = pollenStatus;
        this._fipsStatus = fipsStatus;
        return this.status();
    }

    descriptorFor({
        ownerPubkey = globalThis.meshdropNostrIdentity?.getIdentity?.()?.pubkey,
        sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        expiresAt = Date.now() + 10 * 60 * 1000,
        now = Date.now()
    } = {}) {
        const descriptor = {
            version: 1,
            routeId: `android-native-pollen:${sessionId}`,
            routeType: "pollen",
            transportShape: "object-store",
            sessionId,
            ownerPubkey: String(ownerPubkey || "").toLowerCase(),
            expiresAt,
            endpoint: {
                primitive: this.protocol.pollenPrimitive(this._pollenStatus),
                uploadPath: this.protocol.uploadPath,
                downloadPath: this.protocol.downloadPath,
                runtimeId: this.protocol.runtimeId()
            },
            overlayIdentity: {},
            constraints: {
                encrypted: true,
                private: true,
                fallback: false,
                native: true
            },
            capabilities: {
                androidNative: true,
                webRtcDataPath: false,
                fipsStatusOnly: this._fipsStatus?.available === true
            }
        };
        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, {
            expectedOwnerPubkey: descriptor.ownerPubkey,
            expectedSessionId: descriptor.sessionId,
            now
        });
        if (result && !result.ok) throw new Error(`Android native route descriptor rejected: ${result.reason}`);

        return descriptor;
    }

    acceptDescriptor(descriptor, context = {}) {
        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, context);
        if (!result?.ok) throw new Error(`Android native route descriptor rejected: ${result?.reason || "invalid-descriptor"}`);
        if (result.descriptor.routeType !== "pollen") throw new Error("Android native route type mismatch");
        if (result.descriptor.transportShape !== "object-store") throw new Error("Android native route shape mismatch");
        if (result.descriptor.endpoint?.primitive !== this.protocol.pollenPrimitive(this._pollenStatus)) {
            throw new Error("Android native route primitive mismatch");
        }

        return result.descriptor;
    }

    async send(files, {
        ownerPubkey = globalThis.meshdropNostrIdentity?.getIdentity?.()?.pubkey || "",
        sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        senderRuntime = this.protocol.runtimeId()
    } = {}) {
        await this._ensurePollenAvailable();
        const list = Array.isArray(files) ? files : [files];
        if (!list.length || !list.every(file => file instanceof File)) {
            throw new Error("Android native route send requires File inputs");
        }

        const descriptors = [];
        let bytesSent = 0;
        for (const file of list) {
            const descriptor = await this._uploadFile(file);
            const expectedHash = await this.protocol.hashFile(file);
            if (descriptor.hash !== expectedHash) throw new Error("Android native Pollen upload hash mismatch");
            descriptors.push(descriptor);
            bytesSent += descriptor.size;
        }

        const routeDescriptor = this.descriptorFor({ownerPubkey, sessionId});
        const proofSeed = {
            senderRuntime,
            routeType: "pollen",
            dataPlanePrimitive: this.protocol.pollenPrimitive(this._pollenStatus),
            webRtcUsed: false,
            instanceRelayed: false,
            bytesSent,
            fallbackUsed: false
        };
        this._lastSend = {descriptors, proofSeed, routeDescriptor};

        return {
            descriptors,
            routeDescriptor,
            proofSeed
        };
    }

    async receive(descriptors, {
        senderRuntime = this._lastSend?.proofSeed?.senderRuntime || this.protocol.runtimeId(),
        recipientRuntime = this.protocol.runtimeId(),
        bytesSent = this._lastSend?.proofSeed?.bytesSent
    } = {}) {
        await this._ensurePollenAvailable();
        const list = Array.isArray(descriptors) ? descriptors : [descriptors];
        if (!list.length) throw new Error("Android native route receive requires descriptors");

        const files = [];
        let bytesReceived = 0;
        for (const descriptor of list) {
            const file = await this._downloadDescriptor(descriptor);
            const expected = this.protocol.validateObjectDescriptor(descriptor);
            const actualHash = await this.protocol.hashFile(file);
            if (actualHash !== expected.hash) throw new Error("Android native Pollen download hash mismatch");
            files.push(file);
            bytesReceived += file.size;
        }

        const proof = {
            senderRuntime,
            recipientRuntime,
            routeType: "pollen",
            dataPlanePrimitive: this.protocol.pollenPrimitive(this._pollenStatus),
            webRtcUsed: false,
            instanceRelayed: false,
            bytesSent: Number.isFinite(bytesSent) ? bytesSent : bytesReceived,
            bytesReceived,
            hashMatched: true,
            fallbackUsed: false
        };
        const result = globalThis.MeshDropRouteContract?.validateRouteProof?.(proof);
        if (!result?.ok) throw new Error(`Android native route proof rejected: ${result?.reason || "invalid-proof"}`);
        this._lastProof = result.proof;

        return {files, proof: result.proof};
    }

    close() {}

    proof() {
        return this._lastProof;
    }

    async _fetchStatus(kind) {
        try {
            return await this.protocol.fetchJson(this.protocol.statusPaths[kind]);
        } catch (error) {
            return {
                enabled: true,
                available: false,
                backend: kind === "fips" ? "android-native-fips-status" : "android-native-object-store",
                error: error.message
            };
        }
    }

    async _ensurePollenAvailable() {
        if (!this._pollenStatus) await this.refreshStatus();
        if (!this.protocol.baseUrl()) throw new Error("Android native backend is unavailable");
        if (this._pollenStatus?.available !== true) {
            throw new Error(this._pollenStatus?.error || "Android native Pollen is unavailable");
        }
    }

    async _uploadFile(file) {
        const response = await fetch(this.protocol.endpoint(this.protocol.uploadPath), {
            method: "POST",
            headers: {"Content-Type": file.type || "application/octet-stream"},
            body: file
        });
        if (!response.ok) throw new Error(`Android native Pollen upload failed: ${response.status}`);

        return this.protocol.validateObjectDescriptor(await response.json(), file);
    }

    async _downloadDescriptor(descriptor) {
        const object = this.protocol.validateObjectDescriptor(descriptor);
        const response = await fetch(this.protocol.endpoint(`${this.protocol.downloadPath}/${object.hash}`));
        if (!response.ok) throw new Error(`Android native Pollen download failed: ${response.status}`);
        const blob = await response.blob();

        return new File([blob], object.name, {type: object.type});
    }
}

globalThis.AndroidNativeRouteProtocol = AndroidNativeRouteProtocol;
globalThis.AndroidNativeRouteAdapter = AndroidNativeRouteAdapter;
globalThis.meshdropAndroidNativeRouteAdapter = new AndroidNativeRouteAdapter();
