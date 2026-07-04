import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {generateSecretKey, getPublicKey, nip19} from "nostr-tools";

import {mappedPort, run, waitForHealth, waitForHttp} from "./docker-two-host-support.mjs";

const project = `meshdrop-admin-uat-${process.pid}`;
const container = project;
const image = process.env.MESHDROP_DOCKER_DEPLOYED_ADMIN_IMAGE || "meshdrop:deployed-admin-uat";
const relayUrls = process.env.MESHDROP_DOCKER_DEPLOYED_ADMIN_RELAYS || "wss://bucket.coracle.social";
const adminSecretKey = generateSecretKey();
const adminSecretKeyHex = bytesToHex(adminSecretKey);
const adminPubkey = getPublicKey(adminSecretKey);
const adminNpub = nip19.npubEncode(adminPubkey);
const discoverySecretKey = generateSecretKey();
const discoveryNpub = nip19.npubEncode(getPublicKey(discoverySecretKey));
const fipsPeerNpub = nip19.npubEncode(getPublicKey(generateSecretKey()));
let composeOverridePath = "";

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-admin-uat-"));
    composeOverridePath = path.join(tempDir, "compose.override.yml");
    await fs.writeFile(composeOverridePath, composeOverride(), "utf8");

    try {
        await runCompose(["up", "--build", "-d", "meshdrop"], {env: {MESH_DROP_COMMIT: "deployed-admin-uat"}});
        await waitForHealth(container);

        const port = await mappedPort(container);
        const baseUrl = `http://127.0.0.1:${port}`;
        await waitForHttp(`${baseUrl}/config`);
        await assertComposeDeployment(baseUrl);
        await run("node", ["scripts/docker-browser-transfer-smoke.mjs"], {
            env: {
                MESHDROP_DOCKER_TRANSFER_BASE_URL: baseUrl,
                MESHDROP_DOCKER_ADMIN_SECRET_KEY: adminSecretKeyHex,
                MESHDROP_DOCKER_ADMIN_FIPS_PEER_NPUB: fipsPeerNpub
            }
        });

        console.log(`Proof docker-deployed-admin-settings: compose admin ${adminNpub} saved FIPS peers on ${baseUrl}`);
        console.log(`Docker deployed-admin UAT passed for ${image} on ${baseUrl}`);
    }
    catch (error) {
        await printContainerLogs();
        throw error;
    }
    finally {
        await runCompose(["down", "-v", "--remove-orphans"], {allowFailure: true});
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

function composeOverride() {
    return `services:
  meshdrop:
    container_name: ${container}
    image: ${image}
    restart: "no"
    environment:
      MESHDROP_ADMIN_NPUB: ${adminNpub}
      MESHDROP_NOSTR_SECRET_KEY: ${adminSecretKeyHex}
      MESHDROP_DISCOVERY_NPUBS: ${discoveryNpub}
      NOSTR_RELAYS: ${relayUrls}
      FIPS_DISCOVERY: "true"
      FIPS_CONTROL_TIMEOUT_MS: "5000"
      POLLEN_TRANSFER: "true"
      WS_FALLBACK: "false"
      RATE_LIMIT: "false"
      RTC_CONFIG: "false"
      DEBUG_MODE: "false"
    ports: !override
      - "127.0.0.1::3000"
      - "127.0.0.1::2121/udp"
      - "127.0.0.1::8443"
      - "127.0.0.1::60611/udp"
`;
}

async function assertComposeDeployment(baseUrl) {
    const env = await inspectContainerEnv();
    assert(env.MESHDROP_ADMIN_NPUB === adminNpub, "compose did not configure the admin npub");
    assert(env.MESHDROP_DISCOVERY_NPUBS === discoveryNpub, "compose did not configure discovery npubs");
    assert(env.NOSTR_RELAYS === relayUrls, "compose did not configure Nostr relays");
    assert(!("NOSTR_ROOM" in env), "compose deployment still exposes NOSTR_ROOM");
    assert(!("FIPS_ROOM" in env), "compose deployment still exposes FIPS_ROOM");

    const config = await getJson(`${baseUrl}/config`);
    assert(config.admin?.enabled === true, "deployed admin config is not enabled");
    assert(config.admin?.pubkey === adminPubkey, "deployed admin pubkey does not match configured admin npub");
    assert(config.admin?.npub === adminNpub, "deployed admin npub does not match configured admin npub");
    assert(config.capabilities?.runtime?.target === "standalone", "compose runtime target is not standalone");
    assert(config.capabilities?.runtime?.hasBackend === true, "compose runtime did not expose backend capability");
    assert(config.capabilities?.serverSettings?.actions?.fipsPeers === true, "signed FIPS settings action is not exposed");
    assert(config.fips?.enabled === true, "compose FIPS is not enabled");
    assert(config.pollen?.enabled === true, "compose Pollen is not enabled");
    assert(isConfiguredNpubNetwork(config.fips?.room), `FIPS room did not use configured npub network: ${config.fips?.room}`);
    assert(isConfiguredNpubNetwork(config.pollen?.room), `Pollen room did not use configured npub network: ${config.pollen?.room}`);
}

async function inspectContainerEnv() {
    const output = await run("docker", ["inspect", container, "--format", "{{json .Config.Env}}"], {capture: true});
    return Object.fromEntries(JSON.parse(output).map(entry => {
        const index = entry.indexOf("=");
        return index === -1 ? [entry, ""] : [entry.slice(0, index), entry.slice(index + 1)];
    }));
}

async function getJson(url) {
    const response = await fetch(url);
    assert(response.ok, `${url} returned ${response.status}`);
    return response.json();
}

function isConfiguredNpubNetwork(value) {
    return typeof value === "string" && value.startsWith("npub-network:") && value !== "npub-network:unconfigured";
}

async function runCompose(args, options = {}) {
    return run("docker", [
        "compose",
        "-p",
        project,
        "-f",
        "docker-compose.yml",
        "-f",
        composeOverridePath,
        ...args
    ], options);
}

async function printContainerLogs() {
    await run("docker", ["logs", container], {allowFailure: true});
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function bytesToHex(bytes) {
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
