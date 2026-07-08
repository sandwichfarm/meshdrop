#!/usr/bin/env node
import fs from "node:fs";
import {fileURLToPath} from "node:url";

import {createRelayIceConfig} from "../server/relay-ice-config.js";

const BLOCKER_URL = "https://github.com/sandwichfarm/meshdrop/issues/152";
const OVERLAY_RELAY_ROUTES = new Set(["fips", "pollen", "tor", "i2p", "loki"]);

const isPlainObject = value => !!value && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = value => typeof value === "string" && value.trim().length > 0;

export class OverlayRelayPreflightError extends Error {
    constructor(reason, message = reason) {
        super(message);
        this.name = "OverlayRelayPreflightError";
        this.reason = reason;
    }
}

function routeEnvValue(env, routeType, name) {
    const prefix = routeType.toUpperCase();
    return env[`${prefix}_${name}`]
        || env[`MESHDROP_${prefix}_${name}`]
        || env[`MESH_DROP_${prefix}_${name}`]
        || "";
}

function parseJsonEvidence(routeType, raw, source) {
    try {
        const parsed = JSON.parse(raw);
        if (!isPlainObject(parsed)) {
            throw new OverlayRelayPreflightError(
                `${routeType}-relay-topology-evidence-invalid`,
                `${source} must contain a JSON object`
            );
        }
        return parsed;
    } catch (error) {
        if (error instanceof OverlayRelayPreflightError) throw error;
        throw new OverlayRelayPreflightError(
            `${routeType}-relay-topology-evidence-invalid-json`,
            `${source} must contain valid JSON`
        );
    }
}

export function routeFromEnv(env = process.env) {
    return String(env.MESHDROP_OVERLAY_RELAY_ROUTE || env.OVERLAY_RELAY_ROUTE || "fips")
        .trim()
        .toLowerCase();
}

export function loadTopologyEvidence(routeType, env = process.env) {
    const file = routeEnvValue(env, routeType, "RELAY_TOPOLOGY_EVIDENCE_FILE");
    if (file) {
        return parseJsonEvidence(routeType, fs.readFileSync(file, "utf8"), file);
    }

    const raw = routeEnvValue(env, routeType, "RELAY_TOPOLOGY_EVIDENCE");
    if (!raw) return null;
    return parseJsonEvidence(routeType, raw, `${routeType.toUpperCase()}_RELAY_TOPOLOGY_EVIDENCE`);
}

export function relayEndpointsFromConfig(relayIce = {}) {
    const servers = Array.isArray(relayIce.rtcConfig?.iceServers) ? relayIce.rtcConfig.iceServers : [];
    return servers.flatMap(server => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.filter(isNonEmptyString);
    });
}

export function runOverlayRelayPreflight({
    routeType = routeFromEnv(),
    env = process.env,
    relayIce = createRelayIceConfig(routeType, env),
    topologyEvidence = loadTopologyEvidence(routeType, env)
} = {}) {
    if (!OVERLAY_RELAY_ROUTES.has(routeType)) {
        throw new OverlayRelayPreflightError("unsupported-overlay-relay-route");
    }
    if (!relayIce.supported) {
        throw new OverlayRelayPreflightError(
            relayIce.unavailableReason || `${routeType}-relay-ice-not-configured`
        );
    }

    const relayEndpoints = relayEndpointsFromConfig(relayIce);
    if (!relayEndpoints.length) {
        throw new OverlayRelayPreflightError(`${routeType}-relay-ice-not-configured`);
    }
    if (!isPlainObject(topologyEvidence)) {
        throw new OverlayRelayPreflightError(`${routeType}-relay-topology-evidence-missing`);
    }
    if (topologyEvidence.overlay !== routeType) {
        throw new OverlayRelayPreflightError("topology-overlay-mismatch");
    }
    if (!isNonEmptyString(topologyEvidence.relayEndpoint)) {
        throw new OverlayRelayPreflightError("topology-relay-endpoint-missing");
    }
    if (!relayEndpoints.includes(topologyEvidence.relayEndpoint)) {
        throw new OverlayRelayPreflightError("topology-relay-endpoint-mismatch");
    }

    return {
        ok: true,
        routeType,
        status: "preflight-ready",
        relayEndpoints,
        topologyEvidence: {...topologyEvidence},
        blocker: BLOCKER_URL,
        provenTransfer: false
    };
}

function main() {
    try {
        const result = runOverlayRelayPreflight({routeType: routeFromEnv(process.env)});
        console.log("Overlay relay preflight ready:");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        const reason = error instanceof OverlayRelayPreflightError ? error.reason : "overlay-relay-preflight-failed";
        console.error(`Overlay relay preflight blocked: ${reason}`);
        console.error(`Issue: ${BLOCKER_URL}`);
        if (!(error instanceof OverlayRelayPreflightError) && error?.stack) {
            console.error(error.stack);
        }
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
