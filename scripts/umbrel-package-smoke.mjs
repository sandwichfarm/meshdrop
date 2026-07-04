import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildUmbrelPackage} from "./build-umbrel-package.mjs";
import {mappedPort, run, waitForHealth, waitForHttp} from "./docker-two-host-support.mjs";

const project = `meshdrop-umbrel-smoke-${process.pid}`;
const container = `${project}-server`;
const image = process.env.MESHDROP_UMBREL_IMAGE || "meshdrop:umbrel-smoke";

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-umbrel-package-"));
    const outDir = path.join(tempDir, "dist");
    const unpackDir = path.join(tempDir, "unpacked");
    const appDataDir = path.join(tempDir, "app-data");
    const composeOverridePath = path.join(tempDir, "compose.override.yml");
    let packageDir = "";

    try {
        if (process.env.MESHDROP_UMBREL_SKIP_BUILD !== "1") {
            await run("docker", ["build", "-t", image, "--build-arg", "MESHDROP_TARGET=umbrel", "."]);
        }

        const result = await buildUmbrelPackage({
            version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-smoke",
            outDir,
            image
        });
        await fs.mkdir(unpackDir, {recursive: true});
        await fs.mkdir(appDataDir, {recursive: true});
        await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

        packageDir = path.join(unpackDir, result.prefix);
        await fs.writeFile(composeOverridePath, composeOverride(), "utf8");

        await runCompose(["up", "-d", "server"], packageDir, composeOverridePath, appDataDir);
        await waitForHealth(container);

        const port = await mappedPort(container);
        const baseUrl = `http://127.0.0.1:${port}`;
        await waitForHttp(`${baseUrl}/config`);
        await assertUmbrelDeployment(baseUrl);
        await run("node", ["scripts/docker-browser-transfer-smoke.mjs"], {
            env: {
                MESHDROP_DOCKER_TRANSFER_BASE_URL: baseUrl
            }
        });

        console.log(`Proof umbrel-package-local-webrtc: rendered Umbrel package served transfer UI on ${baseUrl}`);
        console.log(`Umbrel package smoke passed for ${result.artifactPath}`);
    }
    catch (error) {
        await printContainerLogs();
        throw error;
    }
    finally {
        if (packageDir) {
            await runCompose(["down", "-v", "--remove-orphans"], packageDir, composeOverridePath, appDataDir, {
                allowFailure: true
            });
        }
        await relaxTempPermissions(tempDir);
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

function composeOverride() {
    return `services:
  app_proxy:
    image: busybox:1.36
    command: ["sh", "-c", "sleep infinity"]
  server:
    container_name: ${container}
    restart: "no"
    ports: !override
      - "127.0.0.1::3000"
      - "127.0.0.1::60611/udp"
`;
}

async function assertUmbrelDeployment(baseUrl) {
    const env = await inspectContainerEnv();
    assert(env.MESHDROP_TARGET === "umbrel", "rendered compose did not configure MESHDROP_TARGET=umbrel");
    assert(env.POLLEN_TRANSFER === "true", "rendered compose did not enable Pollen transfer");
    assert(env.FIPS_DISCOVERY === "false", "rendered compose should keep FIPS disabled until target UAT exists");
    assert("MESHDROP_DISCOVERY_NPUBS" in env, "rendered compose did not expose MESHDROP_DISCOVERY_NPUBS");
    assert("MESHDROP_ADMIN_NPUB" in env, "rendered compose did not expose MESHDROP_ADMIN_NPUB");
    assert(!("NOSTR_ROOM" in env), "rendered compose still exposes NOSTR_ROOM");
    assert(!("FIPS_ROOM" in env), "rendered compose still exposes FIPS_ROOM");
    assert(!("POLLEN_ROOM" in env), "rendered compose still exposes POLLEN_ROOM");

    const config = await getJson(`${baseUrl}/config`);
    assert(config.capabilities?.runtime?.target === "umbrel", "runtime target is not umbrel");
    assert(config.capabilities?.runtime?.hasBackend === true, "Umbrel runtime did not expose backend capability");
    assert(config.capabilities?.transports?.pollen?.supported === true, "Umbrel Pollen capability is not enabled");
    assert(config.capabilities?.transports?.fips?.supported === false, "Umbrel FIPS capability should remain disabled");
    assert(config.pollen?.enabled === true, "Umbrel Pollen config is not enabled");
    assert(config.fips?.enabled === false, "Umbrel FIPS config should remain disabled");
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

function runCompose(args, packageDir, composeOverridePath, appDataDir, options = {}) {
    return run("docker", [
        "compose",
        "-p",
        project,
        "-f",
        path.join(packageDir, "docker-compose.yml"),
        "-f",
        composeOverridePath,
        ...args
    ], {
        ...options,
        env: {
            APP_DATA_DIR: appDataDir,
            ...options.env
        }
    });
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
