/* eslint-disable no-undef */

const InstanceRelayTransferProtocol = {
    descriptorTtlMs: 10 * 60 * 1000,
    pubkeyPattern: /^[0-9a-f]{64}$/i,

    runtimeId() {
        return `browser:${globalThis.location?.host || "unknown"}`;
    },

    normalizeRooms(rooms = []) {
        return [...new Set((Array.isArray(rooms) ? rooms : [])
            .filter(room => typeof room === "string" && room.trim())
            .map(room => room.trim()))];
    },

    normalizeEndpoint(endpoint = {}, primitive, runtimeId = this.runtimeId()) {
        const normalized = {
            ...endpoint,
            primitive,
            runtimeId
        };
        if (Array.isArray(endpoint.rooms)) {
            normalized.rooms = this.normalizeRooms(endpoint.rooms);
        }
        return normalized;
    },

    buildDescriptor({
        routeType,
        primitive,
        ownerPubkey,
        sessionId,
        routeId = `${routeType}-instance-relay:${sessionId}`,
        expiresAt = Date.now() + this.descriptorTtlMs,
        endpoint = {},
        overlayIdentity = {},
        runtimeId = this.runtimeId()
    } = {}) {
        if (!routeType) throw new Error("Instance relay route type is missing");
        if (!primitive) throw new Error("Instance relay primitive is missing");
        if (!this.pubkeyPattern.test(ownerPubkey || "")) {
            throw new Error("Instance relay owner pubkey is invalid");
        }
        if (!sessionId) throw new Error("Instance relay session is missing");

        const descriptor = {
            version: 1,
            routeId,
            routeType,
            transportShape: "instance-relay",
            sessionId,
            ownerPubkey: ownerPubkey.toLowerCase(),
            expiresAt,
            endpoint: this.normalizeEndpoint(endpoint, primitive, runtimeId),
            overlayIdentity: {...overlayIdentity},
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
        if (result && !result.ok) throw new Error(`Instance relay descriptor rejected: ${result.reason}`);

        return descriptor;
    },

    buildProofSeed({routeType, primitive, senderRuntime = this.runtimeId(), bytesSent = 0} = {}) {
        if (!routeType) throw new Error("Instance relay route type is missing");
        if (!primitive) throw new Error("Instance relay primitive is missing");
        if (!senderRuntime) throw new Error("Instance relay sender runtime is missing");
        if (!Number.isFinite(bytesSent) || bytesSent <= 0) {
            throw new Error("Instance relay byte count is invalid");
        }

        return {
            senderRuntime,
            routeType,
            dataPlanePrimitive: primitive,
            webRtcUsed: false,
            instanceRelayed: true,
            bytesSent,
            fallbackUsed: false
        };
    },

    validateRequest(request = {}, {
        metadataKey = "instanceRelay",
        routeType,
        primitive,
        now = Date.now()
    } = {}) {
        const relay = request[metadataKey] || {};
        const descriptor = relay.descriptor;
        const proofSeed = relay.proofSeed || {};
        if (!descriptor) throw new Error("Instance relay descriptor is missing");
        if (!proofSeed.senderRuntime) throw new Error("Instance relay sender runtime is missing");
        if (proofSeed.fallbackUsed === true) throw new Error("Instance relay fallback is forbidden");
        if (proofSeed.routeType !== routeType) throw new Error("Instance relay route type mismatch");
        if (proofSeed.dataPlanePrimitive !== primitive) {
            throw new Error("Instance relay data-plane primitive mismatch");
        }
        if (proofSeed.webRtcUsed !== false) throw new Error("Instance relay WebRTC byte path is forbidden");
        if (proofSeed.instanceRelayed !== true) throw new Error("Instance relay flag is missing");

        const expectedOwnerPubkey = request.payloadEncryption?.keyDelivery?.senderPubkey;
        const expectedSessionId = request.payloadEncryption?.transferId;
        if (!this.pubkeyPattern.test(expectedOwnerPubkey || "")) {
            throw new Error("Instance relay owner binding is missing");
        }
        if (!expectedSessionId) throw new Error("Instance relay session binding is missing");

        const result = globalThis.MeshDropRouteContract?.validateDescriptor?.(descriptor, {
            expectedOwnerPubkey,
            expectedSessionId,
            now
        });
        if (!result?.ok) {
            const reason = result?.reason || "invalid-descriptor";
            if (reason === "session-mismatch") throw new Error("Instance relay session mismatch");
            if (reason === "owner-mismatch") throw new Error("Instance relay owner mismatch");
            if (reason === "expired") throw new Error("Instance relay descriptor expired");
            throw new Error(`Instance relay descriptor rejected: ${reason}`);
        }
        if (result.descriptor.routeType !== routeType) throw new Error("Instance relay descriptor route mismatch");
        if (result.descriptor.transportShape !== "instance-relay") {
            throw new Error("Instance relay descriptor shape mismatch");
        }
        if (result.descriptor.endpoint?.primitive !== primitive) {
            throw new Error("Instance relay descriptor primitive mismatch");
        }
        if (result.descriptor.constraints?.encrypted !== true) {
            throw new Error("Instance relay descriptor encryption constraint is missing");
        }
        if (result.descriptor.constraints?.private !== true) {
            throw new Error("Instance relay descriptor privacy constraint is missing");
        }
        if (result.descriptor.constraints?.fallback !== false) {
            throw new Error("Instance relay descriptor fallback constraint is invalid");
        }
        if (result.descriptor.capabilities?.instanceRelay !== true) {
            throw new Error("Instance relay descriptor missing instance relay capability");
        }
        if (result.descriptor.capabilities?.webRtcDataPath !== false) {
            throw new Error("Instance relay descriptor WebRTC byte path is forbidden");
        }

        return {
            descriptor: result.descriptor,
            proofSeed: {...proofSeed}
        };
    },

    finalizeProof({
        relay,
        encryptedFiles = [],
        recipientRuntime = this.runtimeId(),
        hashMatched = false
    } = {}) {
        if (!relay?.proofSeed) throw new Error("Instance relay proof seed is missing");
        if (!recipientRuntime) throw new Error("Instance relay recipient runtime is missing");

        const bytesReceived = encryptedFiles.reduce((total, file) => total + Number(file?.size || 0), 0);
        const proof = {
            ...relay.proofSeed,
            recipientRuntime,
            bytesReceived,
            hashMatched
        };
        const result = globalThis.MeshDropRouteContract?.validateRouteProof?.(proof);
        if (!result?.ok) {
            throw new Error(`Instance relay proof rejected: ${result?.reason || "invalid-proof"}`);
        }

        return result.proof;
    }
};

globalThis.InstanceRelayTransferProtocol = InstanceRelayTransferProtocol;
