import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {generateSecretKey, getPublicKey, nip19} from "nostr-tools";

const execFileAsync = promisify(execFile);

export const minute = 60 * 1000;

export function createIdentity() {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    return {
        nsec: nip19.nsecEncode(secretKey),
        npub: nip19.npubEncode(pubkey),
        pubkey
    };
}

export async function writeFipsConfig({tempDir, name, identity, peers}) {
    const configPath = path.join(tempDir, `${name}.yaml`);
    const config = `node:
  identity:
    nsec: "${identity.nsec}"
  control:
    socket_path: "/run/fips/control.sock"
tun:
  enabled: true
  name: fips0
  mtu: 1280
dns:
  enabled: true
  bind_addr: "::1"
  port: 5354
transports:
  udp:
    bind_addr: "0.0.0.0:2121"
    mtu: 1472
peers:${renderPeers(peers)}
`;
    await fs.writeFile(configPath, config);
    return configPath;
}

export async function assertNoDirectPeerConfigFiles({label, configAPath, configBPath, identityA, identityB}) {
    const [configA, configB] = await Promise.all([
        fs.readFile(configAPath, "utf8"),
        fs.readFile(configBPath, "utf8")
    ]);
    assert(!configA.includes(identityB.npub), `${label} A config lists B directly`);
    assert(!configB.includes(identityA.npub), `${label} B config lists A directly`);
}

export async function startFipsContainer({name, alias, configPath, image, network}) {
    await run("docker", [
        "run",
        "-d",
        "--name",
        name,
        "--network",
        network,
        "--network-alias",
        alias,
        "--cap-add",
        "NET_ADMIN",
        "--device",
        "/dev/net/tun",
        "-e",
        "POLLEN_TRANSFER=false",
        "-e",
        "FIPS_DISCOVERY=true",
        "-e",
        "FIPS_STREAM_TRANSFER=true",
        "-e",
        "FIPS_CONFIG=/etc/fips/fips.yaml",
        "-v",
        `${configPath}:/etc/fips/fips.yaml:ro`,
        image
    ]);
}

export async function waitForApp(container) {
    await waitFor(async () => {
        const config = await getJsonFromContainer(container, "http://127.0.0.1:3000/config");
        return config.capabilities?.transports?.fips?.stream?.supported === true;
    }, `${container} app ready`, {timeoutMs: 90_000});
}

export async function waitForFipsPeer(container, expectedPeerCount = 1) {
    let lastStatus = null;
    await waitFor(async () => {
        lastStatus = await fipsStatus(container);
        return lastStatus.available === true && Number(lastStatus.peerCount || 0) >= expectedPeerCount;
    }, `${container} FIPS peer count ${expectedPeerCount}`, {timeoutMs: 90_000});
    return lastStatus;
}

export async function uploadPayload(container, payload) {
    const script = `
const payload = process.env.MESHDROP_PAYLOAD;
(async () => {
  const response = await fetch("http://127.0.0.1:3000/fips/upload", {
    method: "POST",
    headers: {"Content-Type": "text/plain"},
    body: payload
  });
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  console.log(JSON.stringify(body));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
`;
    return JSON.parse(await run("docker", [
        "exec",
        "-e",
        `MESHDROP_PAYLOAD=${payload}`,
        container,
        "node",
        "-e",
        script
    ], {capture: true}));
}

export async function fetchFromContainer(container, url) {
    const script = `
const crypto = require("node:crypto");
const url = process.env.MESHDROP_FIPS_URL;
(async () => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(JSON.stringify({
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    text: buffer.toString("utf8")
  }));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
`;
    return JSON.parse(await run("docker", [
        "exec",
        "-e",
        `MESHDROP_FIPS_URL=${url}`,
        container,
        "node",
        "-e",
        script
    ], {capture: true}));
}

export async function waitForFetchFromContainer(container, url, label, {timeoutMs = 90_000} = {}) {
    let received = null;
    await waitFor(async () => {
        received = await fetchFromContainer(container, url);
        return true;
    }, label, {timeoutMs, intervalMs: 2000});
    return received;
}

export async function resolveFipsIdentity(container, npub, expectedIpv6Addr) {
const script = `
const dns = require("node:dns").promises;
const resolver = new dns.Resolver();
resolver.setServers(["[::1]:5354"]);
(async () => {
  const records = await resolver.resolve6(process.env.MESHDROP_FIPS_HOST);
  console.log(JSON.stringify({records}));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
`;
    const host = `${npub}.fips`;
    const result = JSON.parse(await run("docker", [
        "exec",
        "-e",
        `MESHDROP_FIPS_HOST=${host}`,
        container,
        "node",
        "-e",
        script
    ], {capture: true}));
    assert(
        result.records?.includes(expectedIpv6Addr),
        `${container} DNS did not resolve ${host} to ${expectedIpv6Addr}: ${JSON.stringify(result.records || [])}`
    );
    return result.records;
}

export async function getJsonFromContainer(container, url) {
    const script = `
const url = process.env.MESHDROP_URL;
(async () => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  console.log(JSON.stringify(await response.json()));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
`;
    return JSON.parse(await run("docker", [
        "exec",
        "-e",
        `MESHDROP_URL=${url}`,
        container,
        "node",
        "-e",
        script
    ], {capture: true}));
}

export async function fipsStatus(container) {
    const status = await getJsonFromContainer(container, "http://127.0.0.1:3000/fips/status");
    assert(status.available === true, `${container} FIPS unavailable: ${status.error || "unknown"}`);
    assert(status.ipv6Addr, `${container} FIPS status missing ipv6Addr`);
    return status;
}

export async function fipsDeviceBytes(container) {
    const output = await run("docker", ["exec", container, "node", "-e", `
const fs = require("node:fs");
const line = fs.readFileSync("/proc/net/dev", "utf8").split("\\n").find(entry => entry.trim().startsWith("fips0:"));
if (!line) throw new Error("missing fips0 device stats");
const values = line.split(":")[1].trim().split(/\\s+/).map(Number);
console.log(JSON.stringify({rx: values[0], tx: values[8]}));
`], {capture: true});
    return JSON.parse(output);
}

export function assertFipsDeviceTrafficIncreased(before, after, label) {
    const beforeTraffic = before.rx + before.tx;
    const afterTraffic = after.rx + after.tx;
    assert(
        afterTraffic > beforeTraffic,
        `${label} fips0 counters did not increase: ${beforeTraffic} -> ${afterTraffic}`
    );
}

export function deviceDelta(before, after) {
    return (after.rx + after.tx) - (before.rx + before.tx);
}

export function buildFipsInstanceRelayRequest(request) {
    const {
        ownerPubkey,
        recipientPubkey,
        sessionId,
        baseUrl,
        upload,
        bytesSent,
        senderRuntime
    } = request;
    const descriptor = globalThis.FipsStreamTransferProtocol.buildInstanceRelayDescriptor({
        ownerPubkey,
        sessionId,
        baseUrl,
        files: [upload],
        runtimeId: senderRuntime
    });
    const proofSeed = globalThis.FipsStreamTransferProtocol.buildInstanceRelayProofSeed({
        senderRuntime,
        bytesSent
    });

    return {
        payloadEncryption: {
            transferId: sessionId,
            keyDelivery: {
                senderPubkey: ownerPubkey,
                recipientPubkey
            }
        },
        fipsInstanceRelay: {
            descriptor,
            proofSeed
        }
    };
}

export function validateFipsStreamProof({relayRequest, received, fileName, recipientRuntime}) {
    const relay = globalThis.FipsStreamTransferProtocol.validateInstanceRelayRequest(relayRequest);
    const proof = globalThis.InstanceRelayTransferProtocol.finalizeProof({
        relay,
        encryptedFiles: [new File([Buffer.from(received.text)], fileName, {type: "text/plain"})],
        recipientRuntime,
        hashMatched: true
    });
    const proofResult = globalThis.MeshDropRouteContract.validateRouteProof(proof);
    assert(proofResult.ok, `route proof rejected: ${proofResult.reason}`);
    assert(proof.instanceRelayed === true, "instance relay proof flag mismatch");
    assert(proof.bytesSent === received.bytes, "instance relay sent byte count mismatch");
    assert(proof.bytesReceived === received.bytes, "instance relay received byte count mismatch");
    return proof;
}

export async function step(prefix, label, action) {
    process.stdout.write(`[${prefix}] ${label}\n`);
    return action();
}

export async function run(command, args, {timeoutMs = 30_000, capture = false, allowFailure = false} = {}) {
    try {
        const result = await execFileAsync(command, args, {
            timeout: timeoutMs,
            maxBuffer: 10 * 1024 * 1024
        });
        return capture ? result.stdout.trim() : result;
    } catch (error) {
        if (allowFailure) return capture ? (error.stdout || "").trim() : error;
        const stderr = error.stderr ? `\n${error.stderr}` : "";
        const stdout = error.stdout ? `\n${error.stdout}` : "";
        throw new Error(`${command} ${args.join(" ")} failed${stdout}${stderr}`);
    }
}

export function sha256Hex(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function waitFor(check, label, {timeoutMs = 45_000, intervalMs = 1000} = {}) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeoutMs) {
        try {
            if (await check()) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ""}`);
}

function renderPeers(peers = []) {
    if (!peers.length) return " []";
    return peers.map(peer => `
  - npub: "${peer.identity.npub}"
    alias: "${peer.alias}"
    addresses:
      - transport: udp
        addr: "${peer.alias}:2121"
    connect_policy: auto_connect`).join("");
}
