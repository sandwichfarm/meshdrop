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
        rtcConfig: {
            ...rtcConfig,
            iceServers,
            iceTransportPolicy: "relay"
        }
    };
}

export function createRelayIceConfig(routeType, env = process.env) {
    const prefix = routeType.toUpperCase();
    const configPath = relayEnvValue(env, prefix, "RELAY_ICE_CONFIG");
    if (configPath && configPath !== "false") {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
        return normalizeRelayIceConfig(routeType, {
            rtcConfig: parsed.rtcConfig || parsed
        });
    }

    const urlsValue = relayEnvValue(env, prefix, "RELAY_ICE_URLS");
    const urls = (urlsValue === "false" ? "" : urlsValue)
        .split(",")
        .map(url => url.trim())
        .filter(Boolean);
    if (urls.length === 0) {
        return normalizeRelayIceConfig(routeType);
    }

    const iceServer = {urls};
    const username = relayEnvValue(env, prefix, "RELAY_ICE_USERNAME");
    const credential = relayEnvValue(env, prefix, "RELAY_ICE_CREDENTIAL");
    const credentialType = relayEnvValue(env, prefix, "RELAY_ICE_CREDENTIAL_TYPE");
    if (username) iceServer.username = username;
    if (credential) iceServer.credential = credential;
    if (credentialType) iceServer.credentialType = credentialType;

    return normalizeRelayIceConfig(routeType, {
        rtcConfig: {
            iceServers: [iceServer]
        }
    });
}
