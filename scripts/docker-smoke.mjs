import {spawn} from "node:child_process";
import {generateSecretKey, getPublicKey} from "nostr-tools";

const image = process.env.MESHDROP_DOCKER_IMAGE || "meshdrop:smoke";
const container = `meshdrop-smoke-${process.pid}`;
const smokeAdminSecretKey = generateSecretKey();
const smokeAdminSecretKeyHex = bytesToHex(smokeAdminSecretKey);
const smokeAdminPubkey = getPublicKey(smokeAdminSecretKey);
const minute = 60 * 1000;

async function main() {
    await step("build Docker image", () => run("docker", ["build", "-t", image, "."], {timeoutMs: 10 * minute}));

    let started = false;
    try {
        await step("start container", startContainer);
        started = true;

        const port = await step("resolve mapped port", mappedPort);
        const baseUrl = `http://127.0.0.1:${port}`;

        await step("wait for /config", () => waitForHttp(`${baseUrl}/config`));
        await step("wait for healthcheck", waitForHealth);
        await step("assert /config", () => assertContainerConfig(baseUrl));
        await step("assert FIPS status", () => assertFipsStatus(baseUrl));
        await step("assert Pollen status", () => assertPollenStatus(baseUrl));
        await step("assert federation descriptor", () => assertFederation(baseUrl));
        await step("assert served page", () => assertServedPage(baseUrl));
        await step("assert runtime capabilities script", () => assertRuntimeCapabilitiesScript(baseUrl));
        await step("run browser transfer smoke", () => runBrowserSmoke(baseUrl));
        await step("assert admin GUI FIPS commands", assertAdminGuiDroveFipsCommands);
        await step("run two-host relay smoke", runTwoHostRelaySmoke);

        console.log(`Docker smoke passed for ${image} on ${baseUrl}`);
    }
    finally {
        if (started) await run("docker", ["rm", "-f", container], {allowFailure: true});
    }
}

async function startContainer() {
    await run("docker", [
        "run",
        "-d",
        "--name",
        container,
        "-p",
        "127.0.0.1::3000",
        "-e",
        "FIPS_DISCOVERY=true",
        "-e",
        "FIPS_CONTROL_SOCKET=21210",
        "-e",
        "FIPS_CONTROL_TIMEOUT_MS=1000",
        "-e",
        "MESHDROP_FIPS_CONTROL_SMOKE_LOG=/tmp/meshdrop-fips-control-smoke.jsonl",
        "-e",
        `MESHDROP_ADMIN_NPUB=${smokeAdminPubkey}`,
        "--entrypoint",
        "sh",
        image,
        "-c",
        "node scripts/fips-control-smoke-mock.mjs & exec scripts/start-with-fips.sh"
    ]);
}

async function assertContainerConfig(baseUrl) {
    const config = await getJson(`${baseUrl}/config`);
    assert(Array.isArray(config.nostrMesh?.relays), "Nostr mesh relays were not exposed");
    assert(config.fips?.enabled === true, "FIPS config was not enabled in container");
    assert((config.fips?.room || "").startsWith("npub-network:"), "FIPS config did not use npub network discovery");
    assert(config.admin?.enabled === true, "Admin config was not enabled in container");
    assert(config.admin?.pubkey === smokeAdminPubkey, "Admin pubkey was not exposed in container config");
    assert(config.capabilities?.runtime?.target === "standalone", "Runtime target capability was not exposed");
    assert(config.capabilities?.runtime?.hasBackend === true, "Backend runtime capability was not exposed");
    assert(config.capabilities?.transports?.fips?.supported === true, "FIPS capability was not exposed");
    assert(config.capabilities?.transports?.pollen?.supported === true, "Pollen capability was not exposed");
    assert(config.capabilities?.serverSettings?.actions?.fipsPeers === true, "Signed FIPS settings missing");
    assert(config.pollen?.enabled === true, "Pollen config was not enabled in container");
    assert((config.pollen?.room || "").startsWith("npub-network:"), "Pollen config did not use npub network discovery");
    assert(Array.isArray(config.blossom?.servers), "Blossom config was not exposed");
}

async function assertFipsStatus(baseUrl) {
    const fipsStatus = await getJson(`${baseUrl}/fips/status`);
    assert(fipsStatus.enabled === true, "FIPS status did not reflect configured discovery");
    assert(fipsStatus.available === true, "Smoke FIPS control mock was not reachable from the container");
}

async function assertPollenStatus(baseUrl) {
    const pollenStatus = await getJson(`${baseUrl}/pollen/status`);
    assert(pollenStatus.enabled === true, "Pollen status did not reflect configured transfer");
    assert(pollenStatus.available === true, "Container-local Pollen daemon was not reachable");
    assert(pollenStatus.version, "Container-local Pollen version was not reported");
}

async function assertFederation(baseUrl) {
    const federation = await getJson(`${baseUrl}/.well-known/meshdrop-federation`);
    assert(federation.kind === "meshdrop-federation", "Federation descriptor missing");
    assert(federation.pollen?.serviceName, "Pollen federation service was not advertised");
}

async function assertServedPage(baseUrl) {
    const page = await getText(baseUrl);
    [
        ["<title>MeshDrop", "MeshDrop title missing from served page"],
        ["https://github.com/sandwichfarm/PairDrop", "MeshDrop GitHub link missing from info overlay"],
        ["https://nostr.com", "Nostr link missing from info overlay"],
        ["https://github.com/hzrd149/blossom", "Blossom link missing from info overlay"],
        ["https://hashtree.cc", "Hashtree link missing from info overlay"],
        ["https://github.com/nostr-protocol/nips/pull/363", "NIP-100 link missing from info overlay"],
        ["https://fips.network", "FIPS link missing from info overlay"],
        ["https://github.com/schlagmichdoch/PairDrop", "PairDrop credit link missing from info overlay"],
        ["id=\"nostr-identity\"", "Nostr identity control missing from served page"],
        ["id=\"nostr-mesh\"", "Nostr mesh control missing from served page"],
        ["id=\"fips-discovery\"", "FIPS discovery control missing from served page"],
        ["id=\"blossom-transfer\"", "Blossom transfer control missing from served page"],
        ["id=\"hashtree-transfer\"", "Hashtree transfer control missing from served page"]
    ].forEach(([needle, message]) => assert(page.includes(needle), message));
}

async function assertRuntimeCapabilitiesScript(baseUrl) {
    const script = await getText(`${baseUrl}/scripts/runtime-capabilities.js`);
    assert(script.includes("RuntimeCapabilities"), "Runtime capabilities script was not served");
}

async function runBrowserSmoke(baseUrl) {
    await run("node", ["scripts/docker-browser-transfer-smoke.mjs"], {
        timeoutMs: 8 * minute,
        env: {
            MESHDROP_DOCKER_TRANSFER_BASE_URL: baseUrl,
            MESHDROP_DOCKER_ADMIN_SECRET_KEY: smokeAdminSecretKeyHex
        }
    });
}

async function assertAdminGuiDroveFipsCommands() {
    const commands = await readFipsMockCommands();
    assert(
        commands.some(request => request.command === "connect") && commands.some(request => request.command === "restart"),
        "Admin GUI smoke did not drive FIPS connect and restart commands"
    );
}

async function runTwoHostRelaySmoke() {
    await run("node", ["scripts/docker-two-host-relay-smoke.mjs"], {
        timeoutMs: 8 * minute,
        env: {
            MESHDROP_DOCKER_IMAGE: image,
            MESHDROP_DOCKER_SKIP_BUILD: "1"
        }
    });
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: new URL("..", import.meta.url),
            env: {...process.env, ...options.env},
            stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timeout = options.timeoutMs ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
        }, options.timeoutMs) : null;

        if (options.capture) {
            child.stdout.on("data", chunk => stdout += chunk.toString("utf8"));
            child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
        }

        child.on("error", reject);
        child.on("close", code => {
            if (timeout) clearTimeout(timeout);
            if (timedOut) {
                reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms\n${stderr}`));
                return;
            }
            if (code === 0 || options.allowFailure) {
                resolve(stdout.trim());
            }
            else {
                reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stderr}`));
            }
        });
    });
}

async function step(name, action) {
    const started = Date.now();
    console.log(`[docker-smoke] start: ${name}`);
    const result = await action();
    console.log(`[docker-smoke] done: ${name} (${Date.now() - started}ms)`);
    return result;
}

async function mappedPort() {
    for (let i = 0; i < 30; i++) {
        const output = await run("docker", ["port", container, "3000/tcp"], {capture: true});
        const match = output.match(/127\.0\.0\.1:(\d+)/);
        if (match) return match[1];
        await delay(250);
    }

    throw new Error("Docker did not publish container port 3000");
}

async function waitForHttp(url) {
    for (let i = 0; i < 60; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        }
        catch {
            // Retry until the container finishes booting.
        }

        await delay(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

async function waitForHealth() {
    for (let i = 0; i < 40; i++) {
        const status = await run("docker", [
            "inspect",
            "--format",
            "{{.State.Health.Status}}",
            container
        ], {capture: true});

        if (status === "healthy") return;
        if (status === "unhealthy") throw new Error("Container healthcheck failed");
        await delay(500);
    }

    throw new Error("Timed out waiting for healthy container");
}

async function getJson(url) {
    const response = await fetch(url);
    assert(response.ok, `${url} returned ${response.status}`);
    return response.json();
}

async function getText(url) {
    const response = await fetch(url);
    assert(response.ok, `${url} returned ${response.status}`);
    return response.text();
}

async function readFipsMockCommands() {
    const output = await run("docker", [
        "exec",
        container,
        "cat",
        "/tmp/meshdrop-fips-control-smoke.jsonl"
    ], {capture: true});

    return output
        .split("\n")
        .filter(Boolean)
        .map(line => JSON.parse(line));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToHex(bytes) {
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
