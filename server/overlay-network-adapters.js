const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

const overlayNetworks = [
    {id: "tor", envPrefix: "TOR", destinationSuffix: ".onion"},
    {id: "i2p", envPrefix: "I2P", destinationSuffix: ".i2p"},
    {id: "loki", envPrefix: "LOKI", destinationSuffix: ".loki"}
];

export const overlayNetworkIds = overlayNetworks.map(network => network.id);

function envString(env, keys) {
    for (const key of keys) {
        const value = env[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function envDisabled(env, prefix) {
    return env[`${prefix}_STREAM_TRANSFER`] === "false"
        || env[`MESH_DROP_${prefix}_STREAM_TRANSFER`] === "false";
}

function maxUploadBytes(env, prefix) {
    return Number.parseInt(envString(env, [
        `${prefix}_STREAM_MAX_UPLOAD_BYTES`,
        `MESH_DROP_${prefix}_STREAM_MAX_UPLOAD_BYTES`
    ]), 10) || DEFAULT_MAX_UPLOAD_BYTES;
}

function normalizeEndpoint(value, destinationSuffix) {
    if (!value) return {url: "", destination: "", error: ""};

    try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) {
            return {url: "", destination: "", error: "overlay-adapter-invalid-endpoint"};
        }
        if (!url.hostname.toLowerCase().endsWith(destinationSuffix)) {
            return {url: "", destination: "", error: "overlay-adapter-invalid-endpoint"};
        }
        return {
            url: url.toString().replace(/\/$/, ""),
            destination: url.hostname.toLowerCase(),
            error: ""
        };
    } catch {
        return {url: "", destination: "", error: "overlay-adapter-invalid-endpoint"};
    }
}

function createNetworkConfig(network, env) {
    const endpoint = normalizeEndpoint(envString(env, [
        `${network.envPrefix}_STREAM_ENDPOINT`,
        `MESH_DROP_${network.envPrefix}_STREAM_ENDPOINT`
    ]), network.destinationSuffix);
    const disabled = envDisabled(env, network.envPrefix);
    const configured = !disabled && !!endpoint.url;
    const unavailableReason = disabled
        ? "overlay-adapter-disabled"
        : endpoint.error || "overlay-adapter-not-configured";

    return {
        routeType: network.id,
        transportShape: "stream",
        primitive: `${network.id}-http-stream`,
        enabled: configured,
        configured,
        streamEndpoint: endpoint.url,
        destination: endpoint.destination,
        destinationSuffix: network.destinationSuffix,
        maxUploadBytes: maxUploadBytes(env, network.envPrefix),
        unavailableReason: configured ? "" : unavailableReason
    };
}

export function createOverlayNetworkConfig(env = process.env) {
    return Object.fromEntries(overlayNetworks.map(network => [
        network.id,
        createNetworkConfig(network, env)
    ]));
}

function capabilityFor(config = {}, options = {}) {
    const supported = config.enabled === true && config.configured === true;
    const capability = {
        supported,
        requiresBackend: true,
        transportShape: "stream",
        stream: {
            supported,
            primitive: config.primitive || `${config.routeType}-http-stream`,
            endpointConfigured: config.configured === true,
            maxUploadBytes: config.maxUploadBytes || DEFAULT_MAX_UPLOAD_BYTES
        }
    };

    if (!supported) {
        capability.unavailableReason = options.hasBackend === false
            ? "requires-instance-native-route"
            : config.unavailableReason || "overlay-adapter-not-configured";
    }

    return capability;
}

export function createOverlayNetworkCapabilities(config = {}, options = {}) {
    return Object.fromEntries(overlayNetworkIds.map(routeType => [
        routeType,
        capabilityFor(config[routeType] || {routeType}, options)
    ]));
}

export function buildOverlayNetworkDescriptor(config = {}, {
    routeId,
    sessionId,
    ownerPubkey,
    expiresAt
} = {}) {
    if (config.enabled !== true || config.configured !== true) {
        throw new Error(config.unavailableReason || "overlay-adapter-not-configured");
    }

    return {
        version: 1,
        routeId,
        routeType: config.routeType,
        transportShape: "stream",
        sessionId,
        ownerPubkey,
        expiresAt,
        endpoint: {
            url: config.streamEndpoint,
            primitive: config.primitive
        },
        overlayIdentity: {
            network: config.routeType,
            destination: config.destination
        },
        constraints: {
            encrypted: true,
            private: true,
            failClosed: true
        },
        capabilities: {
            maxBytes: config.maxUploadBytes,
            dataPlanePrimitive: config.primitive
        }
    };
}
