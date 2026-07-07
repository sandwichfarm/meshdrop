const transportShapes = new Set([
    "stream",
    "datagram",
    "turn",
    "instance-relay",
    "object-store"
]);
const adapterMethods = [
    "status",
    "capabilities",
    "descriptorFor",
    "acceptDescriptor",
    "send",
    "receive",
    "close",
    "proof"
];

const isPlainObject = value => !!value && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = value => typeof value === "string" && value.trim().length > 0;
const isHexPubkey = value => /^[0-9a-f]{64}$/i.test(value || "");
const failure = reason => ({ok: false, reason});

const cloneRecord = value => isPlainObject(value) ? {...value} : {};
const normalizeRooms = rooms => [...new Set((Array.isArray(rooms) ? rooms : [])
    .filter(isNonEmptyString)
    .map(room => room.trim()))];

const normalizeDescriptor = descriptor => ({
    version: descriptor.version,
    routeId: descriptor.routeId,
    routeType: descriptor.routeType,
    transportShape: descriptor.transportShape,
    sessionId: descriptor.sessionId,
    ownerPubkey: descriptor.ownerPubkey,
    expiresAt: descriptor.expiresAt,
    endpoint: cloneRecord(descriptor.endpoint),
    overlayIdentity: cloneRecord(descriptor.overlayIdentity),
    constraints: cloneRecord(descriptor.constraints),
    capabilities: cloneRecord(descriptor.capabilities)
});

const validateDescriptor = (descriptor, context = {}) => {
    if (!isPlainObject(descriptor)) return failure("invalid-descriptor");
    if (descriptor.version !== 1) return failure("unsupported-version");
    if (!isNonEmptyString(descriptor.routeId)) return failure("missing-route-id");
    if (!isNonEmptyString(descriptor.routeType)) return failure("missing-route-type");
    if (!transportShapes.has(descriptor.transportShape)) return failure("unsupported-transport-shape");
    if (!isNonEmptyString(descriptor.sessionId)) return failure("missing-session-id");
    if (!isHexPubkey(descriptor.ownerPubkey)) return failure("invalid-owner-pubkey");
    if (!Number.isFinite(descriptor.expiresAt)) return failure("invalid-expiration");
    if (Number.isFinite(context.now) && descriptor.expiresAt <= context.now) return failure("expired");
    if (context.expectedOwnerPubkey && descriptor.ownerPubkey !== context.expectedOwnerPubkey) {
        return failure("owner-mismatch");
    }
    if (context.expectedSessionId && descriptor.sessionId !== context.expectedSessionId) {
        return failure("session-mismatch");
    }

    return {
        ok: true,
        descriptor: normalizeDescriptor(descriptor)
    };
};

const validateLegacyRoomDescriptor = (descriptor, context = {}) => {
    if (!isPlainObject(descriptor)) return failure("invalid-descriptor");
    if (!isNonEmptyString(context.expectedOwnerPubkey)) return failure("missing-owner-binding");
    if (!isNonEmptyString(context.expectedSessionId)) return failure("missing-session-binding");
    if (context.expectedRouteType && descriptor.routeType !== context.expectedRouteType) {
        return failure("route-type-mismatch");
    }

    const rooms = normalizeRooms(descriptor.rooms);
    if (!rooms.length) return failure("missing-rooms");

    return validateDescriptor({
        version: 1,
        routeId: `legacy-room:${descriptor.routeType}:${context.expectedSessionId}`,
        routeType: descriptor.routeType,
        transportShape: "instance-relay",
        sessionId: context.expectedSessionId,
        ownerPubkey: context.expectedOwnerPubkey,
        expiresAt: Number(descriptor.expiresAt || 0),
        endpoint: {rooms},
        overlayIdentity: {},
        constraints: {
            encrypted: true,
            private: true
        },
        capabilities: {
            legacyRooms: true
        }
    }, context);
};

const availabilityFromStatus = status => {
    if (!status?.supported) return "unsupported";
    return status.available ? "available" : "unavailable";
};

const validateAdapter = adapter => {
    if (!isPlainObject(adapter)) return failure("invalid-adapter");

    for (const method of adapterMethods) {
        if (typeof adapter[method] !== "function") return failure(`missing-method:${method}`);
    }

    const status = adapter.status() || {};
    const capabilities = adapter.capabilities() || [];

    return {
        ok: true,
        availability: availabilityFromStatus(status),
        reason: status.reason || "",
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        methods: [...adapterMethods]
    };
};

const scoreCandidate = (candidate, context = {}) => {
    const reasons = [];
    let score = 0;

    if (candidate.connected) {
        score += 1000;
        reasons.push("connected");
    }
    if (candidate.available) {
        score += 200;
        reasons.push("available");
    } else {
        score -= 200;
        reasons.push("unavailable");
    }
    if (context.preferredRouteType && candidate.routeType === context.preferredRouteType) {
        score += 300;
        reasons.push("preferred");
    }
    if (candidate.trusted) {
        score += 150;
        reasons.push("trusted");
    }
    if (candidate.private) {
        score += 100;
        reasons.push("private");
    }
    if (candidate.encrypted) {
        score += 50;
        reasons.push("encrypted");
    }
    if (candidate.runtimeSupported === false) {
        score -= 500;
        reasons.push("runtime-unsupported");
    }

    const relayCost = Number(candidate.relayCost || 0);
    if (relayCost > 0) {
        score -= relayCost * 10;
        reasons.push(`relay-cost:${relayCost}`);
    }

    return {
        ...candidate,
        score,
        reasons
    };
};

const rankCandidates = (candidates, context = {}) => (Array.isArray(candidates) ? candidates : [])
    .map((candidate, order) => ({...scoreCandidate(candidate, context), order}))
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .map(candidate => {
        const ranked = {...candidate};
        delete ranked.order;
        return ranked;
    });

const validateRouteProof = proof => {
    if (!isPlainObject(proof)) return failure("invalid-proof");
    for (const field of ["senderRuntime", "recipientRuntime", "routeType", "dataPlanePrimitive"]) {
        if (!isNonEmptyString(proof[field])) return failure(`missing-proof-field:${field}`);
    }
    if (typeof proof.webRtcUsed !== "boolean") return failure("invalid-webrtc-flag");
    if (typeof proof.instanceRelayed !== "boolean") return failure("invalid-instance-relay-flag");
    if (!Number.isFinite(proof.bytesSent) || proof.bytesSent < 0) return failure("invalid-bytes-sent");
    if (!Number.isFinite(proof.bytesReceived) || proof.bytesReceived < 0) return failure("invalid-bytes-received");
    if (proof.bytesSent !== proof.bytesReceived) return failure("byte-count-mismatch");
    if (proof.hashMatched !== true) return failure("hash-mismatch");
    if (proof.fallbackUsed === true) return failure("fallback-used");
    if (proof.dataPlanePrimitive === "webrtc-relay-ice") {
        if (!isNonEmptyString(proof.selectedIceCandidateType)) return failure("missing-proof-field:selectedIceCandidateType");
        if (proof.selectedIceCandidateType !== "relay") return failure("non-relay-ice-candidate");
    }

    return {
        ok: true,
        proof: {...proof}
    };
};

const MeshDropRouteContract = {
    adapterMethods: [...adapterMethods],
    transportShapes: [...transportShapes],
    validateDescriptor,
    validateLegacyRoomDescriptor,
    validateAdapter,
    scoreCandidate,
    rankCandidates,
    validateRouteProof
};

globalThis.MeshDropRouteContract = MeshDropRouteContract;
