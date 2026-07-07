/* eslint-disable no-undef */

const FipsStreamTransferProtocol = {
    statusPath: "fips/status",
    uploadPath: "fips/upload",
    downloadPath: "fips/download",
    primitive: "fips-http-stream",
    descriptorTtlMs: 10 * 60 * 1000,
    idPattern: /^[0-9a-f]{32}$/i,
    tokenPattern: /^[0-9a-f]{64}$/i,
    hashPattern: /^[0-9a-f]{64}$/i,
    pubkeyPattern: /^[0-9a-f]{64}$/i,

    runtimeId() {
        return `browser:${globalThis.location?.host || "unknown"}`;
    },

    endpoint(path) {
        return path;
    },

    fipsMeshBaseUrl(status = {}, location = globalThis.location) {
        const ipv6Addr = String(status.ipv6Addr || "").trim();
        if (!this.isFipsMeshAddress(ipv6Addr)) return "";

        const protocol = location?.protocol === "https:" ? "https:" : "http:";
        const port = location?.port || (protocol === "https:" ? "443" : "80");
        return `${protocol}//[${ipv6Addr}]:${port}`;
    },

    isFipsMeshAddress(value) {
        return /^fd[0-9a-f:.]+$/i.test(String(value || ""));
    },

    assertFipsMeshBaseUrl(baseUrl) {
        let parsed;
        try {
            parsed = new URL(baseUrl);
        } catch {
            throw new Error("FIPS mesh URL is invalid");
        }
        const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
        if (!["http:", "https:"].includes(parsed.protocol) || !this.isFipsMeshAddress(hostname)) {
            throw new Error("FIPS mesh URL must use a FIPS IPv6 address");
        }
        return parsed.toString().replace(/\/$/, "");
    },

    validateFileDescriptor(descriptor = {}) {
        if (!this.idPattern.test(descriptor.id || "")) throw new Error("FIPS stream descriptor id is invalid");
        if (!this.tokenPattern.test(descriptor.token || "")) throw new Error("FIPS stream descriptor token is invalid");
        if (!this.hashPattern.test(descriptor.sha256 || "")) throw new Error("FIPS stream descriptor hash is invalid");
        if (!Number.isSafeInteger(Number(descriptor.size)) || Number(descriptor.size) < 0) {
            throw new Error("FIPS stream descriptor size is invalid");
        }

        return {
            id: String(descriptor.id).toLowerCase(),
            token: String(descriptor.token).toLowerCase(),
            sha256: String(descriptor.sha256).toLowerCase(),
            size: Number(descriptor.size),
            type: descriptor.type || "application/octet-stream"
        };
    },

    buildStreamDescriptor({
        ownerPubkey,
        sessionId,
        baseUrl,
        files = [],
        expiresAt = Date.now() + this.descriptorTtlMs,
        runtimeId = this.runtimeId()
    } = {}) {
        if (!this.pubkeyPattern.test(ownerPubkey || "")) throw new Error("FIPS stream owner pubkey is invalid");
        if (!sessionId) throw new Error("FIPS stream session is missing");
        const normalizedBaseUrl = this.assertFipsMeshBaseUrl(baseUrl);
        const descriptors = files.map(file => this.validateFileDescriptor(file));
        if (!descriptors.length) throw new Error("FIPS stream files are missing");

        const descriptor = {
            version: 1,
            routeId: `fips-stream:${sessionId}`,
            routeType: "fips",
            transportShape: "stream",
            sessionId,
            ownerPubkey: ownerPubkey.toLowerCase(),
            expiresAt,
            endpoint: {
                primitive: this.primitive,
                baseUrl: normalizedBaseUrl,
                downloadPath: this.downloadPath,
                runtimeId,
                files: descriptors
            },
            overlayIdentity: {},
            constraints: {
                encrypted: true,
                private: true,
                fallback: false
            },
            capabilities: {
                webRtcDataPath: false,
                instanceRelay: false
            }
        };

        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, {
            expectedOwnerPubkey: descriptor.ownerPubkey,
            expectedSessionId: descriptor.sessionId,
            now: Date.now()
        });
        if (result && !result.ok) throw new Error(`FIPS stream descriptor rejected: ${result.reason}`);

        return descriptor;
    },

    buildStreamProofSeed({senderRuntime = this.runtimeId(), bytesSent = 0} = {}) {
        if (!senderRuntime) throw new Error("FIPS stream sender runtime is missing");
        if (!Number.isFinite(bytesSent) || bytesSent <= 0) throw new Error("FIPS stream byte count is invalid");

        return {
            senderRuntime,
            routeType: "fips",
            dataPlanePrimitive: this.primitive,
            webRtcUsed: false,
            instanceRelayed: false,
            bytesSent,
            fallbackUsed: false
        };
    },

    validateStreamRequest(request = {}, {now = Date.now()} = {}) {
        const stream = request.fipsStream || {};
        const descriptor = stream.descriptor;
        const proofSeed = stream.proofSeed || {};
        if (!descriptor) throw new Error("FIPS stream descriptor is missing");
        if (!proofSeed.senderRuntime) throw new Error("FIPS stream sender runtime is missing");
        if (proofSeed.fallbackUsed === true) throw new Error("FIPS stream fallback is forbidden");
        if (proofSeed.routeType !== "fips") throw new Error("FIPS stream route type mismatch");
        if (proofSeed.dataPlanePrimitive !== this.primitive) throw new Error("FIPS stream primitive mismatch");
        if (proofSeed.webRtcUsed !== false) throw new Error("FIPS stream WebRTC byte path is forbidden");
        if (proofSeed.instanceRelayed !== false) throw new Error("FIPS stream instance relay flag mismatch");

        const expectedOwnerPubkey = request.payloadEncryption?.keyDelivery?.senderPubkey;
        const expectedSessionId = request.payloadEncryption?.transferId;
        if (!this.pubkeyPattern.test(expectedOwnerPubkey || "")) throw new Error("FIPS stream owner binding is missing");
        if (!expectedSessionId) throw new Error("FIPS stream session binding is missing");

        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, {
            expectedOwnerPubkey,
            expectedSessionId,
            now
        });
        if (!result?.ok) {
            const reason = result?.reason || "invalid-descriptor";
            if (reason === "session-mismatch") throw new Error("FIPS stream session mismatch");
            if (reason === "owner-mismatch") throw new Error("FIPS stream owner mismatch");
            if (reason === "expired") throw new Error("FIPS stream descriptor expired");
            throw new Error(`FIPS stream descriptor rejected: ${reason}`);
        }
        if (result.descriptor.routeType !== "fips") throw new Error("FIPS stream descriptor route mismatch");
        if (result.descriptor.transportShape !== "stream") throw new Error("FIPS stream descriptor shape mismatch");
        if (result.descriptor.endpoint?.primitive !== this.primitive) throw new Error("FIPS stream descriptor primitive mismatch");
        result.descriptor.endpoint.baseUrl = this.assertFipsMeshBaseUrl(result.descriptor.endpoint?.baseUrl);
        result.descriptor.endpoint.files = (result.descriptor.endpoint?.files || [])
            .map(file => this.validateFileDescriptor(file));

        return {
            descriptor: result.descriptor,
            proofSeed: {...proofSeed}
        };
    },

    async payloadHashMatched(request = {}, decryptedFiles = []) {
        const integrity = request.payloadIntegrity;
        if (integrity?.algorithm !== "SHA-256" || !Array.isArray(integrity.files)) {
            throw new Error("FIPS stream payload integrity is missing");
        }
        if (!globalThis.BlossomTransferProtocol?.sha256Hex) {
            throw new Error("FIPS stream hash verification is unavailable");
        }

        for (const entry of integrity.files) {
            const file = decryptedFiles[entry.index];
            if (!file) throw new Error("FIPS stream decrypted file is missing");
            const actual = await globalThis.BlossomTransferProtocol.sha256Hex(file);
            if (actual !== entry.sha256) throw new Error("FIPS stream hash mismatch");
        }

        return true;
    },

    async finalizeStreamProof({
        request,
        encryptedFiles = [],
        decryptedFiles = [],
        recipientRuntime = this.runtimeId(),
        now = Date.now()
    } = {}) {
        const stream = this.validateStreamRequest(request, {now});
        if (!recipientRuntime) throw new Error("FIPS stream recipient runtime is missing");
        const bytesReceived = encryptedFiles.reduce((total, file) => total + Number(file?.size || 0), 0);
        const hashMatched = await this.payloadHashMatched(request, decryptedFiles);
        const proof = {
            ...stream.proofSeed,
            recipientRuntime,
            bytesReceived,
            hashMatched
        };
        const result = globalThis.MeshDropRouteContract?.validateRouteProof?.(proof);
        if (!result?.ok) throw new Error(`FIPS stream proof rejected: ${result?.reason || "invalid-proof"}`);

        return result.proof;
    }
};

globalThis.FipsStreamTransferProtocol = FipsStreamTransferProtocol;

class FipsStreamTransferController {
    constructor() {
        this._config = {};
        this._lastStatus = null;
        this._streamStatus = null;

        Events.on("config", e => this._onConfig(e.detail || {}));
        Events.on("fips-status", e => this._onStatus(e.detail));
        globalThis.meshdropFipsStreamTransfer = this;
    }

    isActive() {
        return globalThis.meshdropFipsDiscovery?.isActive?.() === true
            && this._streamStatus?.available === true;
    }

    runtimeId() {
        return FipsStreamTransferProtocol.runtimeId();
    }

    async fetchStatus() {
        const response = await fetch(FipsStreamTransferProtocol.endpoint(FipsStreamTransferProtocol.statusPath));
        if (!response.ok) throw new Error(`FIPS status failed with ${response.status}`);

        this._onStatus(await response.json());
        return this._streamStatus;
    }

    _onStatus(status = {}) {
        this._lastStatus = status;
        const stream = status.streamTransfer || {};
        const baseUrl = stream.available
            ? FipsStreamTransferProtocol.fipsMeshBaseUrl(status)
            : "";
        this._streamStatus = {
            ...stream,
            baseUrl
        };
    }

    async _onConfig(config) {
        this._config = config;
        if (!FipsDiscoveryProtocol?.enabledFromConfig?.(config)) return;

        try {
            await this.fetchStatus();
        } catch {
            this._streamStatus = {available: false};
        }
    }

    async uploadFiles(files, onProgress = () => {}) {
        if (!this._streamStatus?.available) await this.fetchStatus();
        const baseUrl = this._streamStatus?.baseUrl;
        if (!baseUrl) throw new Error("FIPS stream transfer is unavailable");

        const descriptors = [];
        for (let i = 0; i < files.length; i++) {
            onProgress(0.8 * i / files.length);
            descriptors.push(await this.uploadFile(files[i]));
        }
        onProgress(0.8);
        return {baseUrl, descriptors};
    }

    async uploadFile(file) {
        const response = await fetch(FipsStreamTransferProtocol.endpoint(FipsStreamTransferProtocol.uploadPath), {
            method: "POST",
            headers: {
                "Content-Type": file.type || "application/octet-stream"
            },
            body: file
        });

        if (!response.ok) {
            const error = await response.json().catch(_ => ({}));
            throw new Error(error.error || `FIPS stream upload failed with ${response.status}`);
        }

        return FipsStreamTransferProtocol.validateFileDescriptor(await response.json());
    }

    async downloadDescriptor(descriptor, header, streamDescriptor = null) {
        const fileDescriptor = FipsStreamTransferProtocol.validateFileDescriptor(descriptor);
        const baseUrl = FipsStreamTransferProtocol.assertFipsMeshBaseUrl(streamDescriptor?.endpoint?.baseUrl);
        const url = new URL(`${baseUrl}/${FipsStreamTransferProtocol.downloadPath}/${fileDescriptor.id}`);
        url.searchParams.set("token", fileDescriptor.token);
        const response = await fetch(url.toString());
        if (!response.ok) {
            const error = await response.json().catch(_ => ({}));
            throw new Error(error.error || `FIPS stream download failed with ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size !== fileDescriptor.size) throw new Error("FIPS stream download size mismatch");

        return new File([blob], header.name, {
            type: header.mime || fileDescriptor.type || blob.type || "application/octet-stream"
        });
    }
}

globalThis.FipsStreamTransferController = FipsStreamTransferController;
