import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {
    delay,
    freePort,
    repoRoot,
    run,
    waitForHttp,
    waitForTcp
} from "./turn-relay-smoke-runtime.mjs";

await import("../public/scripts/route-contract.js");

const minute = 60 * 1000;
const torImage = process.env.MESHDROP_TOR_STREAM_IMAGE || "meshdrop:tor-stream-smoke";
const container = `meshdrop-tor-stream-${process.pid}`;
const payload = `meshdrop-tor-stream-proof-${crypto.randomBytes(8).toString("hex")}`;
const payloadSha256 = sha256Hex(Buffer.from(payload));
const helpers = [];

async function main() {
    const appPort = await freePort();
    const socksPort = await freePort();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-tor-stream-"));
    const baseUrl = `http://127.0.0.1:${appPort}`;
    helpers.push(() => fs.rm(tempDir, {recursive: true, force: true}));

    await writeTorImage(tempDir);
    await step("build tor image", () => run("docker", ["build", "-t", torImage, tempDir], {timeoutMs: 10 * minute}));
    await writeTorConfig(tempDir, {appPort, socksPort});
    await step("start tor", () => startTor(tempDir));
    await step("wait tor socks", () => waitForTcp("127.0.0.1", socksPort, "tor socks"));
    const onion = await step("wait onion service", () => waitForOnionHostname(tempDir));
    const streamEndpoint = `http://${onion}/overlay/tor`;
    const app = await step("start app", () => startApp(appPort, streamEndpoint));
    helpers.push(() => {
        if (!app.killed) app.kill("SIGTERM");
    });
    await step("wait app", () => waitForHttp(`${baseUrl}/config`));
    await step("check tor capability", () => assertTorCapability(baseUrl, streamEndpoint));

    const upload = await step("upload payload", () => uploadPayload(baseUrl));
    assert(upload.routeType === "tor", "upload route mismatch");
    assert(upload.primitive === "tor-http-stream", "upload primitive mismatch");
    assert(upload.sha256 === payloadSha256, "upload hash mismatch");
    assert(upload.size === Buffer.byteLength(payload), "upload size mismatch");

    const downloadUrl = `${streamEndpoint}/download/${upload.id}?token=${upload.token}`;
    const received = await step("fetch through tor onion", () => fetchThroughTor(downloadUrl, socksPort));
    const receivedSha256 = sha256Hex(Buffer.from(received));
    assert(received === payload, "downloaded payload mismatch");
    assert(receivedSha256 === payloadSha256, "downloaded hash mismatch");

    const proof = {
        senderRuntime: `node:${appPort}`,
        recipientRuntime: `docker:${container}`,
        routeType: "tor",
        dataPlanePrimitive: "tor-http-stream",
        webRtcUsed: false,
        instanceRelayed: false,
        bytesSent: Buffer.byteLength(payload),
        bytesReceived: Buffer.byteLength(received),
        hashMatched: receivedSha256 === payloadSha256,
        fallbackUsed: false,
        topologyEvidence: {
            overlay: "tor",
            destination: onion,
            proxy: `socks5h://127.0.0.1:${socksPort}`,
            endpoint: downloadUrl
        }
    };
    const proofResult = globalThis.MeshDropRouteContract.validateRouteProof(proof);
    assert(proofResult.ok, `route proof rejected: ${proofResult.reason}`);

    console.log(`Proof tor-http-stream: ${JSON.stringify(proof)}`);
    console.log(`Tor stream smoke passed on ${streamEndpoint}`);
}

async function writeTorImage(tempDir) {
    await fs.writeFile(path.join(tempDir, "Dockerfile"), `FROM debian:bookworm-slim
RUN apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates curl tor \\
    && rm -rf /var/lib/apt/lists/*
`);
}

async function writeTorConfig(tempDir, {appPort, socksPort}) {
    await fs.mkdir(path.join(tempDir, "data"), {recursive: true, mode: 0o700});
    await fs.mkdir(path.join(tempDir, "hidden"), {recursive: true, mode: 0o700});
    await fs.chmod(path.join(tempDir, "data"), 0o700);
    await fs.chmod(path.join(tempDir, "hidden"), 0o700);
    await fs.writeFile(path.join(tempDir, "torrc"), [
        "DataDirectory /tor/data",
        `SocksPort 127.0.0.1:${socksPort}`,
        "HiddenServiceDir /tor/hidden",
        "HiddenServiceVersion 3",
        `HiddenServicePort 80 127.0.0.1:${appPort}`,
        "Log notice stdout",
        ""
    ].join("\n"));
}

async function startTor(tempDir) {
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
        `${tempDir}:/tor`,
        torImage,
        "tor",
        "-f",
        "/tor/torrc"
    ], {timeoutMs: minute});
    helpers.push(() => run("docker", ["rm", "-f", container], {allowFailure: true, capture: true}));
}

async function waitForOnionHostname(tempDir) {
    const hostnamePath = path.join(tempDir, "hidden", "hostname");
    for (let i = 0; i < 120; i++) {
        const hostname = await fs.readFile(hostnamePath, "utf8").catch(() => "");
        const onion = hostname.trim();
        if (/^[a-z2-7]{56}\.onion$/.test(onion)) return onion;
        await delay(1000);
    }
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    throw new Error(`Timed out waiting for onion hostname\n${logs}`);
}

async function startApp(appPort, streamEndpoint) {
    const child = spawn("node", ["server/index.js"], {
        cwd: repoRoot,
        env: {
            ...process.env,
            PORT: String(appPort),
            TOR_STREAM_ENDPOINT: streamEndpoint,
            TOR_STREAM_MAX_UPLOAD_BYTES: "1048576",
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
        if (process.env.MESHDROP_TOR_STREAM_VERBOSE === "1") process.stdout.write(chunk);
    });
    child.on("exit", code => {
        if (code !== null && code !== 0) console.error(`MeshDrop app exited with ${code}\n${stderr}`);
    });
    return child;
}

async function assertTorCapability(baseUrl, streamEndpoint) {
    const response = await fetch(`${baseUrl}/config`);
    const config = await response.json();
    const tor = config.capabilities?.transports?.tor;
    assert(tor?.supported === true, `Tor capability unsupported: ${JSON.stringify(tor)}`);
    assert(tor.stream?.primitive === "tor-http-stream", "Tor primitive mismatch");

    const statusResponse = await fetch(`${baseUrl}/overlay/tor/status`);
    const status = await statusResponse.json();
    assert(status.available === true, `Tor status unavailable: ${JSON.stringify(status)}`);
    assert(status.streamEndpoint === streamEndpoint, "Tor stream endpoint mismatch");
}

async function uploadPayload(baseUrl) {
    const response = await fetch(`${baseUrl}/overlay/tor/upload`, {
        method: "POST",
        headers: {"Content-Type": "text/plain"},
        body: payload
    });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body;
}

async function fetchThroughTor(url, socksPort) {
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
                "--socks5-hostname",
                `127.0.0.1:${socksPort}`,
                url
            ], {capture: true, timeoutMs: 30_000});
        } catch (error) {
            lastError = error;
            await delay(1000);
        }
    }
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    throw new Error(`Timed out fetching ${url} through Tor\n${lastError?.message || lastError}\n${logs}`);
}

async function step(label, action) {
    process.stdout.write(`[tor-stream] ${label}\n`);
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
