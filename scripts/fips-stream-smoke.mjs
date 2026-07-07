import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {generateSecretKey, getPublicKey, nip19} from "nostr-tools";

await import("../public/scripts/route-contract.js");
await import("../public/scripts/instance-relay-transfer.js");
await import("../public/scripts/fips-stream-transfer.js");

const execFileAsync = promisify(execFile);
const minute = 60 * 1000;
const image = process.env.MESHDROP_FIPS_STREAM_IMAGE || "meshdrop:fips-stream-smoke";
const suffix = `${process.pid}`;
const network = `meshdrop-fips-stream-${suffix}`;
const containerA = `meshdrop-fips-stream-a-${suffix}`;
const containerB = `meshdrop-fips-stream-b-${suffix}`;
const payload = `meshdrop-fips-stream-proof-${crypto.randomBytes(8).toString("hex")}`;
const payloadSha256 = sha256Hex(Buffer.from(payload));
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-fips-stream-smoke-"));

async function main() {
    let started = false;
    try {
        await step("build image", () => run("docker", ["build", "-t", image, "."], {timeoutMs: 10 * minute}));
        await step("create network", () => run("docker", ["network", "create", network]));
        const identityA = createIdentity();
        const identityB = createIdentity();
        await writeConfig("a", identityA, identityB, "fips-b");
        await writeConfig("b", identityB, identityA, "fips-a");

        await step("start node A", () => startContainer(containerA, "fips-a", path.join(tempDir, "a.yaml")));
        await step("start node B", () => startContainer(containerB, "fips-b", path.join(tempDir, "b.yaml")));
        started = true;

        await step("wait app A", () => waitForApp(containerA));
        await step("wait app B", () => waitForApp(containerB));
        await step("wait FIPS A peer", () => waitForFipsPeer(containerA));
        await step("wait FIPS B peer", () => waitForFipsPeer(containerB));
        const deviceABefore = await fipsDeviceBytes(containerA);
        const deviceBBefore = await fipsDeviceBytes(containerB);

        const upload = await step("upload sender payload", () => uploadPayload(containerA));
        assert(upload.sha256 === payloadSha256, "upload hash mismatch");
        assert(upload.size === Buffer.byteLength(payload), "upload size mismatch");

        const senderStatus = await getJsonFromContainer(containerA, "http://127.0.0.1:3000/fips/status");
        const relayRequest = buildInstanceRelayRequest({
            ownerPubkey: identityA.pubkey,
            recipientPubkey: identityB.pubkey,
            sessionId: `fips-stream-smoke-${suffix}`,
            baseUrl: `http://[${senderStatus.ipv6Addr}]:3000`,
            upload,
            bytesSent: upload.size
        });
        const downloadUrl = `http://[${senderStatus.ipv6Addr}]:3000/fips/download/${upload.id}?token=${upload.token}`;
        const received = await step("fetch over FIPS", () => fetchFromContainer(containerB, downloadUrl));
        assert(received.text === payload, "downloaded payload mismatch");
        assert(received.sha256 === payloadSha256, "downloaded hash mismatch");

        const statusAAfter = await fipsStatus(containerA);
        const statusBAfter = await fipsStatus(containerB);
        const deviceAAfter = await fipsDeviceBytes(containerA);
        const deviceBAfter = await fipsDeviceBytes(containerB);
        assertFipsDeviceTrafficIncreased(deviceABefore, deviceAAfter, "sender");
        assertFipsDeviceTrafficIncreased(deviceBBefore, deviceBAfter, "recipient");

        const relay = globalThis.FipsStreamTransferProtocol.validateInstanceRelayRequest(relayRequest);
        const proof = globalThis.InstanceRelayTransferProtocol.finalizeProof({
            relay,
            encryptedFiles: [new File([Buffer.from(received.text)], "meshdrop-fips-stream-proof.txt", {type: "text/plain"})],
            recipientRuntime: `docker:${containerB}`,
            hashMatched: true
        });
        const proofResult = globalThis.MeshDropRouteContract.validateRouteProof(proof);
        assert(proofResult.ok, `route proof rejected: ${proofResult.reason}`);
        assert(proof.instanceRelayed === true, "instance relay proof flag mismatch");
        assert(proof.bytesSent === received.bytes, "instance relay sent byte count mismatch");
        assert(proof.bytesReceived === received.bytes, "instance relay received byte count mismatch");

        console.log(
            `Proof fips-instance-relay-route: ${containerB} fetched ${received.bytes} bytes from ${containerA} ` +
            `via ${downloadUrl} route=fips primitive=fips-http-stream webrtc=false ` +
            `instanceRelay=true hashMatched=true fallback=false senderPeerCount=${statusAAfter.peerCount} ` +
            `recipientPeerCount=${statusBAfter.peerCount} senderFips0Bytes=${deviceDelta(deviceABefore, deviceAAfter)} ` +
            `recipientFips0Bytes=${deviceDelta(deviceBBefore, deviceBAfter)}`
        );
    } finally {
        if (started) {
            await run("docker", ["rm", "-f", containerA, containerB], {allowFailure: true});
        }
        await run("docker", ["network", "rm", network], {allowFailure: true});
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

function createIdentity() {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    return {
        nsec: nip19.nsecEncode(secretKey),
        npub: nip19.npubEncode(pubkey),
        pubkey
    };
}

function buildInstanceRelayRequest({ownerPubkey, recipientPubkey, sessionId, baseUrl, upload, bytesSent}) {
    const descriptor = globalThis.FipsStreamTransferProtocol.buildInstanceRelayDescriptor({
        ownerPubkey,
        sessionId,
        baseUrl,
        files: [upload],
        runtimeId: `docker:${containerA}`
    });
    const proofSeed = globalThis.FipsStreamTransferProtocol.buildInstanceRelayProofSeed({
        senderRuntime: `docker:${containerA}`,
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

async function writeConfig(name, identity, peerIdentity, peerHost) {
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
  enabled: false
transports:
  udp:
    bind_addr: "0.0.0.0:2121"
    mtu: 1472
peers:
  - npub: "${peerIdentity.npub}"
    alias: "${peerHost}"
    addresses:
      - transport: udp
        addr: "${peerHost}:2121"
    connect_policy: auto_connect
`;
    await fs.writeFile(path.join(tempDir, `${name}.yaml`), config);
}

async function startContainer(name, alias, configPath) {
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

async function waitForApp(container) {
    await waitFor(async () => {
        const config = await getJsonFromContainer(container, "http://127.0.0.1:3000/config");
        return config.capabilities?.transports?.fips?.stream?.supported === true;
    }, `${container} app ready`);
}

async function waitForFipsPeer(container) {
    let lastStatus = null;
    await waitFor(async () => {
        lastStatus = await fipsStatus(container);
        return lastStatus.available === true && Number(lastStatus.peerCount || 0) >= 1;
    }, `${container} FIPS peer`);
    return lastStatus;
}

async function uploadPayload(container) {
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
    return JSON.parse(await run("docker", ["exec", "-e", `MESHDROP_PAYLOAD=${payload}`, container, "node", "-e", script], {capture: true}));
}

async function fetchFromContainer(container, url) {
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
    return JSON.parse(await run("docker", ["exec", "-e", `MESHDROP_FIPS_URL=${url}`, container, "node", "-e", script], {capture: true}));
}

async function getJsonFromContainer(container, url) {
    const script = `
const url = process.env.MESHDROP_URL;
(async () => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  console.log(JSON.stringify(await response.json()));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
`;
    return JSON.parse(await run("docker", ["exec", "-e", `MESHDROP_URL=${url}`, container, "node", "-e", script], {capture: true}));
}

async function fipsStatus(container) {
    const status = await getJsonFromContainer(container, "http://127.0.0.1:3000/fips/status");
    assert(status.available === true, `${container} FIPS unavailable: ${status.error || "unknown"}`);
    assert(status.ipv6Addr, `${container} FIPS status missing ipv6Addr`);
    return status;
}

async function fipsDeviceBytes(container) {
    const output = await run("docker", ["exec", container, "node", "-e", `
const fs = require("node:fs");
const line = fs.readFileSync("/proc/net/dev", "utf8").split("\\n").find(entry => entry.trim().startsWith("fips0:"));
if (!line) throw new Error("missing fips0 device stats");
const values = line.split(":")[1].trim().split(/\\s+/).map(Number);
console.log(JSON.stringify({rx: values[0], tx: values[8]}));
`], {capture: true});
    return JSON.parse(output);
}

function assertFipsDeviceTrafficIncreased(before, after, label) {
    const beforeTraffic = before.rx + before.tx;
    const afterTraffic = after.rx + after.tx;
    assert(
        afterTraffic > beforeTraffic,
        `${label} fips0 counters did not increase: ${beforeTraffic} -> ${afterTraffic}`
    );
}

function deviceDelta(before, after) {
    return (after.rx + after.tx) - (before.rx + before.tx);
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

async function step(label, action) {
    process.stdout.write(`[fips-stream] ${label}\n`);
    return action();
}

async function run(command, args, {timeoutMs = 30_000, capture = false, allowFailure = false} = {}) {
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

function sha256Hex(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

await main();
