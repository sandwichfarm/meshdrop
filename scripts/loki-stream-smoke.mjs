import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
    delay,
    repoRoot,
    run
} from "./turn-relay-smoke-runtime.mjs";

await import("../public/scripts/route-contract.js");

const minute = 60 * 1000;
const lokiImage = process.env.MESHDROP_LOKI_STREAM_IMAGE || "meshdrop:loki-stream-smoke";
const container = `meshdrop-loki-stream-${process.pid}`;
const helpers = [];
const repoPath = fileURLToPath(repoRoot);

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-loki-stream-"));
    helpers.push(() => fs.rm(tempDir, {recursive: true, force: true}));

    await writeLokiImage(tempDir);
    await writeLokiRunner(tempDir);
    await step("build lokinet image", () => run("docker", ["build", "-t", lokiImage, tempDir], {timeoutMs: 10 * minute}));
    await step("start lokinet container", () => startLokiContainer(tempDir));
    const exitCode = await step("wait lokinet proof", () => waitForContainerExit());
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    if (logs.trim()) process.stdout.write(`${logs.trim()}\n`);
    if (exitCode !== 0) throw new Error(`Loki stream container exited ${exitCode}`);

    const proof = parseProof(logs);
    const proofResult = globalThis.MeshDropRouteContract.validateRouteProof(proof);
    assert(proofResult.ok, `route proof rejected: ${proofResult.reason}`);
}

async function writeLokiImage(tempDir) {
    await fs.writeFile(path.join(tempDir, "Dockerfile"), `FROM node:22-bookworm-slim
RUN apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg dnsutils iproute2 procps \\
    && curl -fsSL https://deb.oxen.io/pub.gpg -o /etc/apt/trusted.gpg.d/oxen.gpg \\
    && echo "deb https://deb.oxen.io bookworm main" > /etc/apt/sources.list.d/oxen.list \\
    && apt-get update \\
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends lokinet \\
    && rm -rf /var/lib/apt/lists/*
`);
}

async function writeLokiRunner(tempDir) {
    await fs.writeFile(path.join(tempDir, "loki-runner.mjs"), `const crypto = await import("node:crypto");
const fs = await import("node:fs/promises");
const {spawn} = await import("node:child_process");
const {pathToFileURL} = await import("node:url");

await import(pathToFileURL("/repo/public/scripts/route-contract.js").href);

const appPort = 18080;
const baseUrl = \`http://127.0.0.1:\${appPort}\`;
const payload = \`meshdrop-loki-stream-proof-\${crypto.randomBytes(8).toString("hex")}\`;
const payloadSha256 = sha256Hex(Buffer.from(payload));
const processes = [];

async function main() {
    await step("configure lokinet", configureLokinet);
    const lokinet = await step("start lokinet", startLokinet);
    processes.push(lokinet);
    const lokiDestination = await step("wait loki destination", waitForLokiDestination);
    await fs.writeFile("/etc/resolv.conf", "nameserver 127.3.2.1\\noptions timeout:1 attempts:1\\n");

    const streamEndpoint = \`http://\${lokiDestination}:\${appPort}/overlay/loki\`;
    const app = await step("start app", () => startApp(streamEndpoint));
    processes.push(app);
    await step("wait app", () => waitForHttp(\`\${baseUrl}/config\`));
    await step("check loki capability", () => assertLokiCapability(streamEndpoint));

    const upload = await step("upload payload", uploadPayload);
    assert(upload.routeType === "loki", "upload route mismatch");
    assert(upload.primitive === "loki-http-stream", "upload primitive mismatch");
    assert(upload.sha256 === payloadSha256, "upload hash mismatch");
    assert(upload.size === Buffer.byteLength(payload), "upload size mismatch");

    const downloadUrl = \`\${streamEndpoint}/download/\${upload.id}?token=\${upload.token}\`;
    const received = await step("fetch through lokinet", () => fetchThroughLoki(downloadUrl));
    const receivedSha256 = sha256Hex(Buffer.from(received));
    assert(received === payload, "downloaded payload mismatch");
    assert(receivedSha256 === payloadSha256, "downloaded hash mismatch");

    const proof = {
        senderRuntime: \`docker:${container}:node:\${appPort}\`,
        recipientRuntime: \`docker:${container}:lokinet\`,
        routeType: "loki",
        dataPlanePrimitive: "loki-http-stream",
        webRtcUsed: false,
        instanceRelayed: false,
        bytesSent: Buffer.byteLength(payload),
        bytesReceived: Buffer.byteLength(received),
        hashMatched: receivedSha256 === payloadSha256,
        fallbackUsed: false,
        topologyEvidence: {
            overlay: "loki",
            destination: lokiDestination,
            resolver: "127.3.2.1:53",
            interface: "lokitun0",
            endpoint: downloadUrl,
            tunnel: "lokinet-local-snapp"
        }
    };
    const proofResult = globalThis.MeshDropRouteContract.validateRouteProof(proof);
    assert(proofResult.ok, \`route proof rejected: \${proofResult.reason}\`);

    console.log(\`Proof loki-http-stream: \${JSON.stringify(proof)}\`);
    console.log(\`Loki stream smoke passed on \${streamEndpoint}\`);
}

async function configureLokinet() {
    let config = await fs.readFile("/etc/loki/lokinet.ini", "utf8");
    config = config
        .replace("#keyfile=", "keyfile=/var/lib/lokinet/meshdrop.private")
        .replace("#ifaddr=", "ifaddr=10.67.0.1/16")
        .replace("#bind=127.3.2.1:53", "bind=127.3.2.1:53");
    await fs.writeFile("/etc/loki/lokinet.ini", config);
}

async function startLokinet() {
    const child = spawn("/usr/bin/lokinet", ["/var/lib/lokinet/lokinet.ini"], {
        stdio: ["ignore", "pipe", "pipe"]
    });
    captureOutput(child, "lokinet");
    return child;
}

async function waitForLokiDestination() {
    for (let i = 0; i < 90; i++) {
        const lookup = await runCommand("host", ["-t", "cname", "localhost.loki", "127.3.2.1"], {
            allowFailure: true
        });
        const match = lookup.stdout.match(/alias for ([a-z0-9]+\\.loki)\\.?/i);
        if (match) return match[1].toLowerCase();
        await delay(1000);
    }
    throw new Error("Timed out waiting for lokinet localhost.loki alias");
}

async function startApp(streamEndpoint) {
    const child = spawn("node", ["server/index.js"], {
        cwd: "/repo",
        env: {
            ...process.env,
            PORT: String(appPort),
            LOKI_STREAM_ENDPOINT: streamEndpoint,
            LOKI_STREAM_MAX_UPLOAD_BYTES: "1048576",
            OVERLAY_STREAM_DIR: "/tmp/meshdrop-loki-overlay-stream",
            WS_FALLBACK: "false",
            RATE_LIMIT: "false",
            FIPS_DISCOVERY: "false",
            POLLEN_TRANSFER: "false",
            BLOSSOM_SERVERS: "",
            NOSTR_RELAYS: ""
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    captureOutput(child, "meshdrop");
    return child;
}

async function assertLokiCapability(streamEndpoint) {
    const response = await fetch(\`\${baseUrl}/config\`);
    const config = await response.json();
    const loki = config.capabilities?.transports?.loki;
    assert(loki?.supported === true, \`Loki capability unsupported: \${JSON.stringify(loki)}\`);
    assert(loki.stream?.primitive === "loki-http-stream", "Loki primitive mismatch");

    const statusResponse = await fetch(\`\${baseUrl}/overlay/loki/status\`);
    const status = await statusResponse.json();
    assert(status.available === true, \`Loki status unavailable: \${JSON.stringify(status)}\`);
    assert(status.streamEndpoint === streamEndpoint, "Loki stream endpoint mismatch");
}

async function uploadPayload() {
    const response = await fetch(\`\${baseUrl}/overlay/loki/upload\`, {
        method: "POST",
        headers: {"Content-Type": "text/plain"},
        body: payload
    });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body;
}

async function fetchThroughLoki(url) {
    let lastError = null;
    for (let i = 0; i < 120; i++) {
        const response = await runCommand("curl", [
            "--fail",
            "--silent",
            "--show-error",
            "--noproxy",
            "*",
            url
        ], {allowFailure: true, timeoutMs: 30_000});
        if (response.code === 0) return response.stdout;
        lastError = response.stderr || response.stdout;
        await delay(1000);
    }
    throw new Error(\`Timed out fetching \${url} through Lokinet\\n\${lastError || ""}\`);
}

async function waitForHttp(url) {
    for (let i = 0; i < 120; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // Retry while MeshDrop boots.
        }
        await delay(250);
    }
    throw new Error(\`Timed out waiting for \${url}\`);
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {stdio: ["ignore", "pipe", "pipe"]});
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timeout = options.timeoutMs
            ? setTimeout(() => {
                timedOut = true;
                child.kill("SIGTERM");
            }, options.timeoutMs)
            : null;
        child.stdout.on("data", chunk => stdout += chunk.toString("utf8"));
        child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
        child.on("error", reject);
        child.on("close", code => {
            if (timeout) clearTimeout(timeout);
            if (timedOut) {
                reject(new Error(\`\${command} \${args.join(" ")} timed out after \${options.timeoutMs}ms\\n\${stderr}\`));
                return;
            }
            const result = {code, stdout: stdout.trim(), stderr: stderr.trim()};
            if (code === 0 || options.allowFailure) resolve(result);
            else reject(new Error(\`\${command} \${args.join(" ")} failed with \${code}\\n\${stderr}\`));
        });
    });
}

function captureOutput(child, label) {
    child.stderr.on("data", chunk => {
        if (process.env.MESHDROP_LOKI_STREAM_VERBOSE === "1") {
            process.stderr.write(\`[\${label}] \${chunk}\`);
        }
    });
    child.stdout.on("data", chunk => {
        if (process.env.MESHDROP_LOKI_STREAM_VERBOSE === "1") {
            process.stdout.write(\`[\${label}] \${chunk}\`);
        }
    });
    child.on("exit", code => {
        if (code !== null && code !== 0) console.error(\`\${label} exited with \${code}\`);
    });
}

async function step(label, action) {
    process.stdout.write(\`[loki-stream] \${label}\\n\`);
    return action();
}

function sha256Hex(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanup() {
    for (const child of processes.reverse()) {
        if (!child.killed) child.kill("SIGTERM");
    }
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(cleanup);
`);
}

async function startLokiContainer(tempDir) {
    await run("docker", ["rm", "-f", container], {allowFailure: true, capture: true});
    await run("docker", [
        "run",
        "-d",
        "--name",
        container,
        "--cap-add=NET_ADMIN",
        "--device=/dev/net/tun",
        "-v",
        `${repoPath}:/repo`,
        "-v",
        `${tempDir}:/meshdrop-smoke:ro`,
        "-w",
        "/repo",
        lokiImage,
        "node",
        "/meshdrop-smoke/loki-runner.mjs"
    ], {timeoutMs: minute});
    helpers.push(() => run("docker", ["rm", "-f", container], {allowFailure: true, capture: true}));
}

async function waitForContainerExit() {
    for (let i = 0; i < 8 * 60; i++) {
        const state = await run("docker", [
            "inspect",
            "-f",
            "{{.State.Running}} {{.State.ExitCode}}",
            container
        ], {allowFailure: true, capture: true});
        const [running, exitCode] = state.trim().split(/\s+/);
        if (running === "false") return Number(exitCode);
        await delay(1000);
    }
    const logs = await run("docker", ["logs", container], {allowFailure: true, capture: true});
    throw new Error(`Timed out waiting for Loki stream proof\n${logs}`);
}

function parseProof(logs) {
    const match = logs.match(/^Proof loki-http-stream: (.+)$/m);
    assert(match, "missing Loki stream proof line");
    return JSON.parse(match[1]);
}

async function step(label, action) {
    process.stdout.write(`[loki-stream] ${label}\n`);
    return action();
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
