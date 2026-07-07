import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import {spawn} from "node:child_process";
import {
    delay,
    freePort,
    repoRoot,
    run,
    waitForHttp
} from "./turn-relay-smoke-runtime.mjs";

await import("../public/scripts/route-contract.js");

const minute = 60 * 1000;
const i2pImage = process.env.MESHDROP_I2P_STREAM_IMAGE || "meshdrop:i2p-stream-smoke";
const container = `meshdrop-i2p-stream-${process.pid}`;
const payload = `meshdrop-i2p-stream-proof-${crypto.randomBytes(8).toString("hex")}`;
const payloadSha256 = sha256Hex(Buffer.from(payload));
const helpers = [];

async function main() {
    const appPort = await freePort();
    const proxyPort = await freePort();
    const consolePort = await freePort();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-i2p-stream-"));
    const baseUrl = `http://127.0.0.1:${appPort}`;
    helpers.push(() => fs.rm(tempDir, {recursive: true, force: true}));

    await writeI2pImage(tempDir);
    await step("build i2pd image", () => run("docker", ["build", "-t", i2pImage, tempDir], {timeoutMs: 10 * minute}));
    await writeI2pConfig(tempDir, {appPort, proxyPort, consolePort});
    await step("start i2pd", () => startI2p(tempDir));
    await step("wait i2pd proxy", () => waitForI2pProxy(proxyPort));
    const i2pDestination = await step("wait i2p destination", () => waitForI2pDestination());
    const streamEndpoint = `http://${i2pDestination}/overlay/i2p`;
    const app = await step("start app", () => startApp(appPort, streamEndpoint));
    helpers.push(() => {
        if (!app.killed) app.kill("SIGTERM");
    });
    await step("wait app", () => waitForHttp(`${baseUrl}/config`));
    await step("check i2p capability", () => assertI2pCapability(baseUrl, streamEndpoint));

    const upload = await step("upload payload", () => uploadPayload(baseUrl));
    assert(upload.routeType === "i2p", "upload route mismatch");
    assert(upload.primitive === "i2p-http-stream", "upload primitive mismatch");
    assert(upload.sha256 === payloadSha256, "upload hash mismatch");
    assert(upload.size === Buffer.byteLength(payload), "upload size mismatch");

    const downloadUrl = `${streamEndpoint}/download/${upload.id}?token=${upload.token}`;
    const received = await step("fetch through i2pd proxy", () => fetchThroughI2p(downloadUrl, proxyPort));
    const receivedSha256 = sha256Hex(Buffer.from(received));
    assert(received === payload, "downloaded payload mismatch");
    assert(receivedSha256 === payloadSha256, "downloaded hash mismatch");

    const proof = {
        senderRuntime: `node:${appPort}`,
        recipientRuntime: `docker:${container}`,
        routeType: "i2p",
        dataPlanePrimitive: "i2p-http-stream",
        webRtcUsed: false,
        instanceRelayed: false,
        bytesSent: Buffer.byteLength(payload),
        bytesReceived: Buffer.byteLength(received),
        hashMatched: receivedSha256 === payloadSha256,
        fallbackUsed: false,
        topologyEvidence: {
            overlay: "i2p",
            destination: i2pDestination,
            proxy: `http://127.0.0.1:${proxyPort}`,
            endpoint: downloadUrl,
            tunnel: "i2pd-http-zero-hop"
        }
    };
    const proofResult = globalThis.MeshDropRouteContract.validateRouteProof(proof);
    assert(proofResult.ok, `route proof rejected: ${proofResult.reason}`);

    console.log(`Proof i2p-http-stream: ${JSON.stringify(proof)}`);
    console.log(`I2P stream smoke passed on ${streamEndpoint}`);
}

async function writeI2pImage(tempDir) {
    await fs.writeFile(path.join(tempDir, "Dockerfile"), `FROM debian:bookworm-slim
RUN apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates curl i2pd \\
    && rm -rf /var/lib/apt/lists/*
`);
}

async function writeI2pConfig(tempDir, {appPort, proxyPort, consolePort}) {
    await fs.mkdir(path.join(tempDir, "i2pd"), {recursive: true, mode: 0o700});
    await fs.mkdir(path.join(tempDir, "i2pd", "destinations"), {recursive: true, mode: 0o700});
    await fs.writeFile(path.join(tempDir, "i2pd", "i2pd.conf"), [
        "log = stdout",
        "loglevel = info",
        "ipv4 = true",
        "ipv6 = false",
        "notransit = true",
        "[http]",
        "enabled = true",
        "address = 127.0.0.1",
        `port = ${consolePort}`,
        "strictheaders = false",
        "[httpproxy]",
        "enabled = true",
        "address = 127.0.0.1",
        `port = ${proxyPort}`,
        "inbound.length = 0",
        "outbound.length = 0",
        "inbound.quantity = 1",
        "outbound.quantity = 1",
        ""
    ].join("\n"));
    await fs.writeFile(path.join(tempDir, "i2pd", "tunnels.conf"), [
        "[meshdrop]",
        "type = http",
        "host = 127.0.0.1",
        `port = ${appPort}`,
        "keys = meshdrop.dat",
        "inbound.length = 0",
        "outbound.length = 0",
        "inbound.quantity = 1",
        "outbound.quantity = 1",
        ""
    ].join("\n"));
}

async function startI2p(tempDir) {
    await run("docker", ["rm", "-f", container], {allowFailure: true, capture: true});
    const dockerUser = typeof process.getuid === "function"
        ? `${process.getuid()}:${process.getgid()}`
        : "0:0";
    await run("docker", [
        "run",
        "-d",
        "--name",
        container,
        "--network",
        "host",
        "--user",
        dockerUser,
        "-v",
        `${path.join(tempDir, "i2pd")}:/i2pd`,
        i2pImage,
        "i2pd",
        "--datadir",
        "/i2pd",
        "--certsdir",
        "/usr/share/i2pd/certificates",
        "--conf",
        "/i2pd/i2pd.conf",
        "--tunconf",
        "/i2pd/tunnels.conf",
        "--log",
        "stdout",
        "--loglevel",
        "info",
        "--notransit"
    ], {timeoutMs: minute});
    helpers.push(() => run("docker", ["rm", "-f", container], {allowFailure: true, capture: true}));
}

async function waitForI2pDestination() {
    const pattern = /meshdrop\.dat for ([a-z2-7]{52,60}\.b32\.i2p) created/;
    for (let i = 0; i < 90; i++) {
        const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
        const match = logs.match(pattern);
        if (match) return match[1];
        await delay(1000);
    }
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    throw new Error(`Timed out waiting for i2pd destination\n${logs}`);
}

async function waitForI2pProxy(proxyPort) {
    for (let i = 0; i < 180; i++) {
        if (await canConnect("127.0.0.1", proxyPort)) return;
        const running = await run("docker", [
            "inspect",
            "-f",
            "{{.State.Running}}",
            container
        ], {allowFailure: true, capture: true});
        if (running.trim() === "false") break;
        await delay(1000);
    }
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    throw new Error(`Timed out waiting for i2pd http proxy on 127.0.0.1:${proxyPort}\n${logs}`);
}

function canConnect(host, port) {
    return new Promise(resolve => {
        const socket = net.createConnection({host, port});
        socket.setTimeout(500);
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("timeout", () => {
            socket.destroy();
            resolve(false);
        });
        socket.once("error", () => resolve(false));
    });
}

async function startApp(appPort, streamEndpoint) {
    const child = spawn("node", ["server/index.js"], {
        cwd: repoRoot,
        env: {
            ...process.env,
            PORT: String(appPort),
            I2P_STREAM_ENDPOINT: streamEndpoint,
            I2P_STREAM_MAX_UPLOAD_BYTES: "1048576",
            WS_FALLBACK: "false",
            RATE_LIMIT: "false",
            FIPS_DISCOVERY: "false",
            POLLEN_TRANSFER: "false",
            BLOSSOM_SERVERS: "",
            NOSTR_RELAYS: ""
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", chunk => {
        stderr += chunk.toString("utf8");
    });
    child.stdout.on("data", chunk => {
        if (process.env.MESHDROP_I2P_STREAM_VERBOSE === "1") process.stdout.write(chunk);
    });
    child.on("exit", code => {
        if (code !== null && code !== 0) console.error(`MeshDrop app exited with ${code}\n${stderr}`);
    });
    return child;
}

async function assertI2pCapability(baseUrl, streamEndpoint) {
    const response = await fetch(`${baseUrl}/config`);
    const config = await response.json();
    const i2p = config.capabilities?.transports?.i2p;
    assert(i2p?.supported === true, `I2P capability unsupported: ${JSON.stringify(i2p)}`);
    assert(i2p.stream?.primitive === "i2p-http-stream", "I2P primitive mismatch");

    const statusResponse = await fetch(`${baseUrl}/overlay/i2p/status`);
    const status = await statusResponse.json();
    assert(status.available === true, `I2P status unavailable: ${JSON.stringify(status)}`);
    assert(status.streamEndpoint === streamEndpoint, "I2P stream endpoint mismatch");
}

async function uploadPayload(baseUrl) {
    const response = await fetch(`${baseUrl}/overlay/i2p/upload`, {
        method: "POST",
        headers: {"Content-Type": "text/plain"},
        body: payload
    });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body;
}

async function fetchThroughI2p(url, proxyPort) {
    let lastError = null;
    for (let i = 0; i < 120; i++) {
        try {
            return await run("docker", [
                "exec",
                container,
                "curl",
                "--fail",
                "--silent",
                "--show-error",
                "--proxy",
                `http://127.0.0.1:${proxyPort}`,
                url
            ], {capture: true, timeoutMs: 30_000});
        } catch (error) {
            lastError = error;
            await delay(1000);
        }
    }
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    throw new Error(`Timed out fetching ${url} through I2P\n${lastError?.message || lastError}\n${logs}`);
}

async function step(label, action) {
    process.stdout.write(`[i2p-stream] ${label}\n`);
    return action();
}

function sha256Hex(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function cleanup() {
    for (const cleanupStep of helpers.reverse()) {
        try {
            await cleanupStep();
        } catch {
            // Best-effort cleanup only.
        }
    }
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(cleanup);
