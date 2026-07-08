import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    assert,
    assertFipsDeviceTrafficIncreased,
    buildFipsInstanceRelayRequest,
    createIdentity,
    deviceDelta,
    fetchFromContainer,
    fipsDeviceBytes,
    fipsStatus,
    minute,
    run,
    sha256Hex,
    startFipsContainer,
    step,
    uploadPayload,
    validateFipsStreamProof,
    waitForApp,
    waitForFipsPeer,
    writeFipsConfig
} from "./fips-smoke-support.mjs";

await import("../public/scripts/route-contract.js");
await import("../public/scripts/instance-relay-transfer.js");
await import("../public/scripts/fips-stream-transfer.js");

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
        await step("fips-stream", "build image", () => run("docker", ["build", "-t", image, "."], {timeoutMs: 10 * minute}));
        await step("fips-stream", "create network", () => run("docker", ["network", "create", network]));
        const identityA = createIdentity();
        const identityB = createIdentity();
        const {configA, configB} = await writeDirectConfigs(identityA, identityB);

        await startDirectContainers(configA, configB);
        started = true;
        await waitForDirectTopology();
        await proveDirectFipsStream(identityA, identityB);
    } finally {
        if (started) {
            await run("docker", ["rm", "-f", containerA, containerB], {allowFailure: true});
        }
        await run("docker", ["network", "rm", network], {allowFailure: true});
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function writeDirectConfigs(identityA, identityB) {
    return {
        configA: await writeFipsConfig({
            tempDir,
            name: "a",
            identity: identityA,
            peers: [{identity: identityB, alias: "fips-b"}]
        }),
        configB: await writeFipsConfig({
            tempDir,
            name: "b",
            identity: identityB,
            peers: [{identity: identityA, alias: "fips-a"}]
        })
    };
}

async function startDirectContainers(configA, configB) {
    await step("fips-stream", "start node A", () => startFipsContainer({
        name: containerA,
        alias: "fips-a",
        configPath: configA,
        image,
        network
    }));
    await step("fips-stream", "start node B", () => startFipsContainer({
        name: containerB,
        alias: "fips-b",
        configPath: configB,
        image,
        network
    }));
}

async function waitForDirectTopology() {
    await step("fips-stream", "wait app A", () => waitForApp(containerA));
    await step("fips-stream", "wait app B", () => waitForApp(containerB));
    await step("fips-stream", "wait FIPS A peer", () => waitForFipsPeer(containerA));
    await step("fips-stream", "wait FIPS B peer", () => waitForFipsPeer(containerB));
}

async function proveDirectFipsStream(identityA, identityB) {
    const deviceABefore = await fipsDeviceBytes(containerA);
    const deviceBBefore = await fipsDeviceBytes(containerB);
    const upload = await step("fips-stream", "upload sender payload", () => uploadPayload(containerA, payload));
    assert(upload.sha256 === payloadSha256, "upload hash mismatch");
    assert(upload.size === Buffer.byteLength(payload), "upload size mismatch");

    const senderStatus = await fipsStatus(containerA);
    const relayRequest = buildFipsInstanceRelayRequest({
        ownerPubkey: identityA.pubkey,
        recipientPubkey: identityB.pubkey,
        sessionId: `fips-stream-smoke-${suffix}`,
        baseUrl: `http://[${senderStatus.ipv6Addr}]:3000`,
        upload,
        bytesSent: upload.size,
        senderRuntime: `docker:${containerA}`
    });
    const downloadUrl = `http://[${senderStatus.ipv6Addr}]:3000/fips/download/${upload.id}?token=${upload.token}`;
    const received = await step("fips-stream", "fetch over FIPS", () => fetchFromContainer(containerB, downloadUrl));
    assert(received.text === payload, "downloaded payload mismatch");
    assert(received.sha256 === payloadSha256, "downloaded hash mismatch");

    const statusAAfter = await fipsStatus(containerA);
    const statusBAfter = await fipsStatus(containerB);
    const deviceAAfter = await fipsDeviceBytes(containerA);
    const deviceBAfter = await fipsDeviceBytes(containerB);
    assertFipsDeviceTrafficIncreased(deviceABefore, deviceAAfter, "sender");
    assertFipsDeviceTrafficIncreased(deviceBBefore, deviceBAfter, "recipient");

    validateFipsStreamProof({
        relayRequest,
        received,
        fileName: "meshdrop-fips-stream-proof.txt",
        recipientRuntime: `docker:${containerB}`
    });

    console.log(
        `Proof fips-instance-relay-route: ${containerB} fetched ${received.bytes} bytes from ${containerA} ` +
        `via ${downloadUrl} route=fips primitive=fips-http-stream webrtc=false ` +
        `instanceRelay=true hashMatched=true fallback=false senderPeerCount=${statusAAfter.peerCount} ` +
        `recipientPeerCount=${statusBAfter.peerCount} senderFips0Bytes=${deviceDelta(deviceABefore, deviceAAfter)} ` +
        `recipientFips0Bytes=${deviceDelta(deviceBBefore, deviceBAfter)}`
    );
}

await main();
