import fs from "fs";

const TURN_URL_PATTERN = /^turns?:/i;

function relayEnvValue(env, prefix, name) {
    return env[`${prefix}_${name}`]
        || env[`MESHDROP_${prefix}_${name}`]
        || env[`MESH_DROP_${prefix}_${name}`]
        || "";
}

function normalizeRelayUrls(urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    const relayUrls = list
        .map(url => String(url || "").trim())
        .filter(url => TURN_URL_PATTERN.test(url));

    if (relayUrls.length === 0) return null;
    return Array.isArray(urls) ? relayUrls : relayUrls[0];
}

function normalizeIceServer(server = {}) {
    const urls = normalizeRelayUrls(server.urls);
    if (!urls) return null;

    const normalized = {urls};
    for (const key of ["username", "credential", "credentialType"]) {
        if (server[key]) normalized[key] = server[key];
    }
    return normalized;
}

function relayIceMetadata(relayIce = {}) {
    const metadata = {};
    for (const key of ["source", "relayRole", "bridgeRole"]) {
        if (relayIce[key]) metadata[key] = String(relayIce[key]);
    }
    if (relayIce.topologyEvidence && typeof relayIce.topologyEvidence === "object") {
        metadata.topologyEvidence = relayIce.topologyEvidence;
    }
    return metadata;
}

function parseTopologyEvidence(env, prefix, ...names) {
    const raw = names.map(name => relayEnvValue(env, prefix, name)).find(Boolean);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {value: String(raw)};
    } catch {
        return {value: String(raw)};
    }
}

function normalizeRelayIceConfigFile(routeType, configPath, source = "") {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const {rtcConfig, source: parsedSource, relayRole, topologyEvidence, ...rest} = parsed;
    return normalizeRelayIceConfig(routeType, {
        rtcConfig: rtcConfig || rest,
        source: parsedSource || source,
        relayRole,
        topologyEvidence
    });
}

function createRelayIceConfigFromEnv(routeType, env, family, metadata = {}) {
    const prefix = routeType.toUpperCase();
    const configPath = relayEnvValue(env, prefix, `${family}_CONFIG`);
    if (configPath && configPath !== "false") {
        return normalizeRelayIceConfigFile(routeType, configPath, metadata.source || "");
    }

    const urlsValue = relayEnvValue(env, prefix, `${family}_URLS`);
    const urls = (urlsValue === "false" ? "" : urlsValue)
        .split(",")
        .map(url => url.trim())
        .filter(Boolean);
    if (urls.length === 0) return null;

    const iceServer = {urls};
    const username = relayEnvValue(env, prefix, `${family}_USERNAME`);
    const credential = relayEnvValue(env, prefix, `${family}_CREDENTIAL`);
    const credentialType = relayEnvValue(env, prefix, `${family}_CREDENTIAL_TYPE`);
    if (username) iceServer.username = username;
    if (credential) iceServer.credential = credential;
    if (credentialType) iceServer.credentialType = credentialType;

    return normalizeRelayIceConfig(routeType, {
        ...metadata,
        rtcConfig: {
            iceServers: [iceServer]
        }
    });
}

export function normalizeRelayIceConfig(routeType, relayIce = {}) {
    if (relayIce.supported === false) {
        return {
            supported: false,
            unavailableReason: `${routeType}-relay-ice-not-configured`
        };
    }

    const rtcConfig = relayIce.rtcConfig || {};
    const iceServers = Array.isArray(rtcConfig.iceServers)
        ? rtcConfig.iceServers.map(normalizeIceServer).filter(Boolean)
        : [];

    if (iceServers.length === 0) {
        return {
            supported: false,
            unavailableReason: `${routeType}-relay-ice-not-configured`
        };
    }

    return {
        supported: true,
        ...relayIceMetadata(relayIce),
        rtcConfig: {
            ...rtcConfig,
            iceServers,
            iceTransportPolicy: "relay"
        }
    };
}

export function createRelayIceConfig(routeType, env = process.env) {
    const prefix = routeType.toUpperCase();
    const configured = createRelayIceConfigFromEnv(routeType, env, "RELAY_ICE");
    if (configured) return configured;

    const instanceBridge = createRelayIceConfigFromEnv(routeType, env, "INSTANCE_ICE_BRIDGE", {
        source: "instance",
        bridgeRole: `${routeType}-instance-ice-bridge`,
        topologyEvidence: parseTopologyEvidence(
            env,
            prefix,
            "INSTANCE_ICE_BRIDGE_TOPOLOGY_EVIDENCE",
            "INSTANCE_BRIDGE_TOPOLOGY_EVIDENCE"
        )
    });
    if (instanceBridge) return instanceBridge;

    const instanceRelay = createRelayIceConfigFromEnv(routeType, env, "INSTANCE_RELAY_ICE", {
        source: "instance",
        bridgeRole: `${routeType}-instance-ice-bridge`,
        topologyEvidence: parseTopologyEvidence(
            env,
            prefix,
            "INSTANCE_RELAY_ICE_TOPOLOGY_EVIDENCE",
            "INSTANCE_RELAY_TOPOLOGY_EVIDENCE"
        )
    });
    if (instanceRelay) return instanceRelay;

    return normalizeRelayIceConfig(routeType);
}
