import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    assert,
    assertFipsDeviceTrafficIncreased,
    assertNoDirectPeerConfigFiles,
    buildFipsInstanceRelayRequest,
    createIdentity,
    deviceDelta,
    fipsDeviceBytes,
    fipsStatus,
    minute,
    resolveFipsIdentity,
    run,
    sha256Hex,
    startFipsContainer,
    step,
    uploadPayload,
    validateFipsStreamProof,
    waitForFetchFromContainer,
    waitForApp,
    waitForFipsPeer,
    writeFipsConfig
} from "./fips-smoke-support.mjs";

await import("../public/scripts/route-contract.js");
await import("../public/scripts/instance-relay-transfer.js");
await import("../public/scripts/fips-stream-transfer.js");

const image = process.env.MESHDROP_FIPS_MESH_IMAGE
    || process.env.MESHDROP_FIPS_STREAM_IMAGE
    || "meshdrop:fips-mesh-smoke";
const suffix = `${process.pid}`;
const network = `meshdrop-fips-mesh-${suffix}`;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-fips-mesh-smoke-"));
const startedContainers = [];

const topologies = [
    {
        proof: "fips-shared-public-peer-route",
        short: "shared-public",
        nodes: ["a", "b", "p"],
        peers: {
            a: ["p"],
            b: ["p"],
            p: ["a", "b"]
        }
    },
    {
        proof: "fips-different-public-peers-route",
        short: "different-public",
        nodes: ["a", "b", "p1", "p2"],
        peers: {
            a: ["p1"],
            b: ["p2"],
            p1: ["a", "p2"],
            p2: ["b", "p1"]
        }
    }
];

async function main() {
    try {
        await step("fips-mesh", "build image", () => run("docker", ["build", "-t", image, "."], {timeoutMs: 10 * minute}));
        await step("fips-mesh", "create network", () => run("docker", ["network", "create", network]));
        for (const topology of topologies) {
            await runTopology(topology);
        }
    } finally {
        if (startedContainers.length) {
            await run("docker", ["rm", "-f", ...startedContainers], {allowFailure: true});
        }
        await run("docker", ["network", "rm", network], {allowFailure: true});
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function runTopology(topology) {
    const nodes = createTopologyNodes(topology);
    const configPaths = await writeTopologyConfigs(topology, nodes);
    await assertNoDirectPeerConfigFiles({
        label: topology.proof,
        configAPath: configPaths.a,
        configBPath: configPaths.b,
        identityA: nodes.a.identity,
        identityB: nodes.b.identity
    });

    await startTopologyContainers(topology, nodes, configPaths);
    await waitForTopology(topology, nodes);
    await proveMeshTopology(topology, nodes);
}

async function startTopologyContainers(topology, nodes, configPaths) {
    for (const key of topology.nodes) {
        const node = nodes[key];
        await step("fips-mesh", `start ${topology.proof} node ${node.label}`, () => startFipsContainer({
            name: node.container,
            alias: node.alias,
            configPath: configPaths[key],
            image,
            network
        }));
        startedContainers.push(node.container);
    }
}

async function waitForTopology(topology, nodes) {
    for (const key of topology.nodes) {
        await step("fips-mesh", `wait ${topology.proof} app ${nodes[key].label}`, () => waitForApp(nodes[key].container));
    }
    for (const key of topology.nodes) {
        const expectedPeerCount = topology.peers[key].length;
        await step(
            "fips-mesh",
            `wait ${topology.proof} FIPS peers ${nodes[key].label}`,
            () => waitForFipsPeer(nodes[key].container, expectedPeerCount)
        );
    }
}

async function proveMeshTopology(topology, nodes) {
    const beforeBytes = await readTopologyDeviceBytes(topology, nodes);
    const beforeRouting = await readTopologyRouting(topology, nodes);
    const payload = `meshdrop-${topology.proof}-${crypto.randomBytes(8).toString("hex")}`;
    const payloadSha256 = sha256Hex(Buffer.from(payload));
    const upload = await step("fips-mesh", `upload ${topology.proof} sender payload`, () => uploadPayload(nodes.a.container, payload));
    assert(upload.sha256 === payloadSha256, `${topology.proof} upload hash mismatch`);
    assert(upload.size === Buffer.byteLength(payload), `${topology.proof} upload size mismatch`);

    const senderStatus = await fipsStatus(nodes.a.container);
    await step(
        "fips-mesh",
        `resolve ${topology.proof} sender identity on B`,
        () => resolveFipsIdentity(nodes.b.container, nodes.a.identity.npub, senderStatus.ipv6Addr)
    );
    const relayRequest = buildFipsInstanceRelayRequest({
        ownerPubkey: nodes.a.identity.pubkey,
        recipientPubkey: nodes.b.identity.pubkey,
        sessionId: `${topology.proof}-${suffix}`,
        baseUrl: `http://[${senderStatus.ipv6Addr}]:3000`,
        upload,
        bytesSent: upload.size,
        senderRuntime: `docker:${nodes.a.container}`
    });
    const downloadUrl = `http://[${senderStatus.ipv6Addr}]:3000/fips/download/${upload.id}?token=${upload.token}`;
    let received;
    try {
        received = await step(
            "fips-mesh",
            `fetch ${topology.proof} over FIPS`,
            () => waitForFetchFromContainer(nodes.b.container, downloadUrl, `${topology.proof} FIPS fetch`)
        );
    } catch (error) {
        await dumpTopologyDiagnostics(topology, nodes, "fetch failure");
        throw error;
    }
    assert(received.text === payload, `${topology.proof} downloaded payload mismatch`);
    assert(received.sha256 === payloadSha256, `${topology.proof} downloaded hash mismatch`);

    const statuses = await readTopologyStatuses(topology, nodes);
    const afterBytes = await readTopologyDeviceBytes(topology, nodes);
    const afterRouting = await readTopologyRouting(topology, nodes);
    for (const key of topology.nodes) {
        if (key === "a" || key === "b") {
            assertFipsDeviceTrafficIncreased(beforeBytes[key], afterBytes[key], `${topology.proof} ${nodes[key].label}`);
        } else {
            assertForwardedTrafficIncreased(beforeRouting[key], afterRouting[key], `${topology.proof} ${nodes[key].label}`);
        }
    }

    validateFipsStreamProof({
        relayRequest,
        received,
        fileName: `meshdrop-${topology.proof}-proof.txt`,
        recipientRuntime: `docker:${nodes.b.container}`
    });

    console.log(
        `Proof ${topology.proof}: ${nodes.b.container} fetched ${received.bytes} bytes from ${nodes.a.container} ` +
        `via ${downloadUrl} route=fips primitive=fips-http-stream webrtc=false instanceRelay=true ` +
        `hashMatched=true fallback=false directABConfig=false peerCounts=${formatPeerCounts(topology, statuses)} ` +
        `fips0Bytes=${formatFips0Deltas(topology, beforeBytes, afterBytes)} ` +
        `forwardedBytes=${formatForwardedDeltas(topology, beforeRouting, afterRouting)}`
    );
}

function createTopologyNodes(topology) {
    return Object.fromEntries(topology.nodes.map(key => {
        const label = key.toUpperCase();
        return [key, {
            key,
            label,
            identity: createIdentity(),
            alias: `fips-${topology.short}-${key}`,
            container: `meshdrop-fips-mesh-${topology.short}-${key}-${suffix}`
        }];
    }));
}

async function writeTopologyConfigs(topology, nodes) {
    const entries = [];
    for (const key of topology.nodes) {
        entries.push([key, await writeFipsConfig({
            tempDir,
            name: `${topology.short}-${key}`,
            identity: nodes[key].identity,
            peers: topology.peers[key].map(peerKey => ({
                identity: nodes[peerKey].identity,
                alias: nodes[peerKey].alias
            }))
        })]);
    }
    return Object.fromEntries(entries);
}

async function readTopologyStatuses(topology, nodes) {
    const entries = [];
    for (const key of topology.nodes) {
        entries.push([key, await fipsStatus(nodes[key].container)]);
    }
    return Object.fromEntries(entries);
}

async function readTopologyDeviceBytes(topology, nodes) {
    const entries = [];
    for (const key of topology.nodes) {
        entries.push([key, await fipsDeviceBytes(nodes[key].container)]);
    }
    return Object.fromEntries(entries);
}

async function readTopologyRouting(topology, nodes) {
    const entries = [];
    for (const key of topology.nodes) {
        const output = await run("docker", [
            "exec",
            nodes[key].container,
            "fipsctl",
            "--socket",
            "/run/fips/control.sock",
            "show",
            "routing"
        ], {capture: true});
        entries.push([key, JSON.parse(output)]);
    }
    return Object.fromEntries(entries);
}

function formatPeerCounts(topology, statuses) {
    return topology.nodes.map(key => `${key.toUpperCase()}=${statuses[key].peerCount}`).join(",");
}

function formatFips0Deltas(topology, beforeBytes, afterBytes) {
    return topology.nodes
        .map(key => `${key.toUpperCase()}=${deviceDelta(beforeBytes[key], afterBytes[key])}`)
        .join(",");
}

function formatForwardedDeltas(topology, beforeRouting, afterRouting) {
    return topology.nodes
        .map(key => `${key.toUpperCase()}=${forwardedDelta(beforeRouting[key], afterRouting[key])}`)
        .join(",");
}

function assertForwardedTrafficIncreased(before, after, label) {
    const beforeForwarded = forwardedBytes(before);
    const afterForwarded = forwardedBytes(after);
    assert(
        afterForwarded > beforeForwarded,
        `${label} forwarded counters did not increase: ${beforeForwarded} -> ${afterForwarded}`
    );
}

function forwardedDelta(before, after) {
    return forwardedBytes(after) - forwardedBytes(before);
}

function forwardedBytes(routing) {
    return Number(routing?.forwarding?.forwarded_bytes || 0);
}

async function dumpTopologyDiagnostics(topology, nodes, reason) {
    for (const key of topology.nodes) {
        const node = nodes[key];
        for (const [name, command] of Object.entries({
            status: ["fipsctl", "--socket", "/run/fips/control.sock", "show", "status"],
            peers: ["fipsctl", "--socket", "/run/fips/control.sock", "show", "peers"],
            tree: ["fipsctl", "--socket", "/run/fips/control.sock", "show", "tree"],
            routing: ["fipsctl", "--socket", "/run/fips/control.sock", "show", "routing"]
        })) {
            const output = await run("docker", ["exec", node.container, ...command], {
                capture: true,
                allowFailure: true
            });
            process.stderr.write(`[fips-mesh] diagnostic ${topology.proof} ${reason} ${node.label} ${name}\n${output}\n`);
        }
    }
}

await main();
