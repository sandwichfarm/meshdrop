import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {run, waitForHttp} from "./docker-two-host-support.mjs";

const supportedTargets = new Set(["start9", "umbrel"]);

export function parseTarget(argv) {
    const target = argv[2] || "";
    if (!supportedTargets.has(target)) {
        throw new Error("Usage: node scripts/deployed-target-uat.mjs <start9|umbrel>");
    }
    return target;
}

export function envKeyForTarget(target) {
    if (target === "start9") return "MESHDROP_START9_UAT_URL";
    if (target === "umbrel") return "MESHDROP_UMBREL_UAT_URL";
    throw new Error(`Unsupported deployed target ${target}`);
}

export function normalizeBaseUrl(value) {
    const trimmed = String(value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`Unsupported deployed target URL protocol ${url.protocol}`);
    }
    return url.toString().replace(/\/+$/, "");
}

export async function assertDeployedTarget(baseUrl, target) {
    await waitForHttp(`${baseUrl}/config`);
    const response = await fetch(`${baseUrl}/config`);
    assert(response.ok, `${baseUrl}/config returned ${response.status}`);
    const config = await response.json();
    assert.equal(config.capabilities?.runtime?.target, target, `deployed runtime target is not ${target}`);
    assert.equal(config.capabilities?.runtime?.hasBackend, true, `${target} runtime did not expose backend capability`);
    assert.equal(config.capabilities?.transports?.pollen?.supported, true, `${target} Pollen capability is not enabled`);
    assert.equal(config.capabilities?.transports?.fips?.supported, false, `${target} FIPS should remain disabled until device-network UAT exists`);
    return config;
}

export async function runDeployedTargetUat(target, env = process.env) {
    const envKey = envKeyForTarget(target);
    const baseUrl = normalizeBaseUrl(env[envKey] || "");
    if (!baseUrl) {
        throw new Error(`Set ${envKey} to the installed ${target} service URL before claiming deployed-device UAT.`);
    }

    await assertDeployedTarget(baseUrl, target);
    await run("node", ["scripts/docker-browser-transfer-smoke.mjs"], {
        env: {
            MESHDROP_DOCKER_TRANSFER_BASE_URL: baseUrl,
            MESHDROP_DOCKER_TRANSFER_PROOF_PREFIX: `${target}-deployed`
        }
    });

    console.log(`Proof ${target}-deployed-device-webrtc: installed ${target} UI transferred files over local and Pollen WebRTC at ${baseUrl}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        await runDeployedTargetUat(parseTarget(process.argv));
    }
    catch (error) {
        console.error(`Not proven: ${error.message}`);
        process.exitCode = 1;
    }
}
