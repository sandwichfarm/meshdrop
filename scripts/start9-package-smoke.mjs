import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildStart9Package} from "./build-start9-package.mjs";
import {mappedPort, run, waitForHealth, waitForHttp} from "./docker-two-host-support.mjs";

const container = `meshdrop-start9-smoke-${process.pid}`;
const image = process.env.MESHDROP_START9_IMAGE || "meshdrop:start9-smoke";

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-start9-package-"));
    const outDir = path.join(tempDir, "dist");
    const unpackDir = path.join(tempDir, "unpacked");
    const dataDir = path.join(tempDir, "data");

    try {
        if (process.env.MESHDROP_START9_SKIP_BUILD !== "1") {
            await run("docker", ["build", "-t", image, "--build-arg", "MESHDROP_TARGET=start9", "."]);
        }

        const result = await buildStart9Package({
            version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-smoke",
            outDir,
            image
        });

        await fs.mkdir(unpackDir, {recursive: true});
        await fs.mkdir(dataDir, {recursive: true});
        await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

        const packageDir = path.join(unpackDir, result.prefix);
        const start9Env = await readStart9Environment(packageDir);
        assertStart9Environment(start9Env);

        await startContainer(start9Env, dataDir);
        await waitForHealth(container);

        const port = await mappedPort(container);
        const baseUrl = `http://127.0.0.1:${port}`;
        await waitForHttp(`${baseUrl}/config`);
        await assertStart9Deployment(baseUrl, start9Env);
        await run("node", ["scripts/docker-browser-transfer-smoke.mjs"], {
            env: {
                MESHDROP_DOCKER_TRANSFER_BASE_URL: baseUrl
            }
        });

        console.log(`Proof start9-package-local-webrtc: generated Start9 env served transfer UI on ${baseUrl}`);
        console.log(`Start9 package smoke passed for ${result.artifactPath}`);
    }
    catch (error) {
        await printContainerLogs();
        throw error;
    }
    finally {
        await run("docker", ["rm", "-f", container], {allowFailure: true});
        await relaxTempPermissions(tempDir);
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function readStart9Environment(packageDir) {
    const mainSource = await fs.readFile(path.join(packageDir, "startos", "main.ts"), "utf8");
    const utilsSource = await fs.readFile(path.join(packageDir, "startos", "utils.ts"), "utf8");
    const env = {};

    for (const match of mainSource.matchAll(/^\s+([A-Z0-9_]+): "([^"]*)",?$/gm)) {
        env[match[1]] = match[2];
    }

    const uiPort = utilsSource.match(/export const uiPort = (\d+);/);
    assert(uiPort, "generated Start9 utils.ts did not declare uiPort");
    assert(/PORT: `\$\{uiPort\}`/.test(mainSource), "generated Start9 main.ts did not wire PORT to uiPort");
    env.PORT = uiPort[1];

    assert(!/NOSTR_ROOM|FIPS_ROOM|POLLEN_ROOM/.test(mainSource), "generated Start9 env still exposes static rooms");
    return env;
}

function assertStart9Environment(env) {
    assert(env.NODE_ENV === "production", "generated Start9 env did not set production mode");
    assert(env.MESHDROP_TARGET === "start9", "generated Start9 env did not configure MESHDROP_TARGET=start9");
    assert(env.PORT === "3000", "generated Start9 env did not expose port 3000");
    assert(env.RATE_LIMIT === "false", "generated Start9 env did not disable reverse-proxy rate limiting");
    assert(env.WS_FALLBACK === "false", "generated Start9 env did not disable WS fallback");
    assert(env.POLLEN_TRANSFER === "true", "generated Start9 env did not enable Pollen transfer");
    assert(env.FIPS_DISCOVERY === "false", "generated Start9 env should keep FIPS disabled until target UAT exists");
    assert(env.PLN_DIR === "/data/pln", "generated Start9 env did not mount Pollen state under /data");
    assert(env.POLLEN_PORT === "60611", "generated Start9 env did not expose the Pollen peer port");
    assert("MESHDROP_DISCOVERY_NPUBS" in env, "generated Start9 env did not expose MESHDROP_DISCOVERY_NPUBS");
    assert("MESHDROP_ADMIN_NPUB" in env, "generated Start9 env did not expose MESHDROP_ADMIN_NPUB");
}

function startContainer(env, dataDir) {
    const envArgs = Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
    return run("docker", [
        "run",
        "-d",
        "--name",
        container,
        "-p",
        "127.0.0.1::3000",
        "-p",
        "127.0.0.1::60611/udp",
        "-v",
        `${dataDir}:/data`,
        ...envArgs,
        image
    ]);
}

async function assertStart9Deployment(baseUrl, env) {
    const containerEnv = await inspectContainerEnv();
    for (const [key, value] of Object.entries(env)) {
        assert(containerEnv[key] === value, `running container did not preserve generated Start9 env ${key}`);
    }

    const config = await getJson(`${baseUrl}/config`);
    assert(config.capabilities?.runtime?.target === "start9", "runtime target is not start9");
    assert(config.capabilities?.runtime?.hasBackend === true, "Start9 runtime did not expose backend capability");
    assert(config.capabilities?.transports?.pollen?.supported === true, "Start9 Pollen capability is not enabled");
    assert(config.capabilities?.transports?.fips?.supported === false, "Start9 FIPS capability should remain disabled");
    assert(config.pollen?.enabled === true, "Start9 Pollen config is not enabled");
    assert(config.fips?.enabled === false, "Start9 FIPS config should remain disabled");
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

async function printContainerLogs() {
    await run("docker", ["logs", container], {allowFailure: true});
}

async function relaxTempPermissions(tempDir) {
    await run("docker", [
        "run",
        "--rm",
        "-v",
        `${tempDir}:${tempDir}`,
        "busybox:1.36",
        "sh",
        "-c",
        `chmod -R a+rwX "${tempDir}" || true`
    ], {allowFailure: true});
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
