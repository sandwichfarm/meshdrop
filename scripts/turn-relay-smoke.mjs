import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {runRelayTransfer} from "./turn-relay-smoke-browser.mjs";
import {
    freePort,
    launchOptions,
    loadPlaywright,
    repoRoot,
    run,
    waitForHttp,
    waitForTcp
} from "./turn-relay-smoke-runtime.mjs";

const turnImage = process.env.MESHDROP_TURN_IMAGE || "coturn/coturn:latest";
const turnContainer = `meshdrop-turn-relay-${process.pid}`;
const turnUsername = "meshdrop";
const turnCredential = "meshdrop-secret";
const processTimeoutMs = 120000;
const helpers = [];

async function main() {
    const appPort = await freePort();
    const turnPort = await freePort();
    const relayMinPort = await freePort();
    const relayMaxPort = relayMinPort + 20;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-turn-relay-"));
    const rtcConfigPath = path.join(tempDir, "rtc-config.json");
    const baseUrl = `http://127.0.0.1:${appPort}`;

    helpers.push(() => fs.rm(tempDir, {recursive: true, force: true}));
    await writeRtcConfig(rtcConfigPath, turnPort);
    await startCoturn(turnPort, relayMinPort, relayMaxPort);
    await waitForTcp("127.0.0.1", turnPort, "coturn");
    await startApp(appPort, rtcConfigPath);
    await waitForHttp(`${baseUrl}/config`);

    const {chromium} = await loadPlaywright();
    const browser = await chromium.launch(await launchOptions());
    try {
        const proof = await runRelayTransfer(browser, baseUrl);
        console.log(`Proof turn-relay-webrtc: ${JSON.stringify(proof)}`);
        console.log(`TURN relay smoke passed on ${baseUrl}`);
    }
    finally {
        await browser.close();
    }
}

async function writeRtcConfig(configPath, turnPort) {
    const rtcConfig = {
        iceServers: [{
            urls: `turn:127.0.0.1:${turnPort}?transport=tcp`,
            username: turnUsername,
            credential: turnCredential
        }],
        iceTransportPolicy: "relay"
    };
    await fs.writeFile(configPath, JSON.stringify(rtcConfig, null, 2));
}

async function startCoturn(turnPort, relayMinPort, relayMaxPort) {
    await run("docker", ["rm", "-f", turnContainer], {allowFailure: true, capture: true});
    await run("docker", [
        "run",
        "-d",
        "--name",
        turnContainer,
        "--network",
        "host",
        turnImage,
        "-n",
        "--log-file=stdout",
        "--lt-cred-mech",
        "--fingerprint",
        "--realm=meshdrop.local",
        `--user=${turnUsername}:${turnCredential}`,
        "--listening-ip=127.0.0.1",
        `--listening-port=${turnPort}`,
        `--min-port=${relayMinPort}`,
        `--max-port=${relayMaxPort}`,
        "--no-cli",
        "--allow-loopback-peers",
        "--no-multicast-peers",
        "--no-software-attribute"
    ], {timeoutMs: processTimeoutMs});
    helpers.push(() => run("docker", ["rm", "-f", turnContainer], {allowFailure: true, capture: true}));
}

async function startApp(appPort, rtcConfigPath) {
    const child = spawn("node", ["server/index.js"], {
        cwd: repoRoot,
        env: {
            ...process.env,
            PORT: String(appPort),
            RTC_CONFIG: rtcConfigPath,
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
        if (process.env.MESHDROP_TURN_RELAY_VERBOSE === "1") process.stdout.write(chunk);
    });
    child.on("exit", code => {
        if (code !== null && code !== 0) {
            console.error(`MeshDrop app exited with ${code}\n${stderr}`);
        }
    });
    helpers.push(() => {
        if (!child.killed) child.kill("SIGTERM");
    });
}

async function cleanup() {
    for (const cleanupStep of helpers.reverse()) {
        try {
            await cleanupStep();
        }
        catch {
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
