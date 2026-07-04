import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import {buildDesktopNativePackage} from "./build-desktop-package.mjs";
import {assert, run} from "./spa-smoke-support.mjs";

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-native-runtime-"));
    let driver = null;

    try {
        const result = await buildDesktopNativePackage({
            version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-smoke",
            outDir: tempDir,
            env: {
                ...process.env,
                MESH_DROP_BUILD_ID: "desktop-native-runtime-smoke"
            }
        });
        const unpackDir = path.join(tempDir, "unpacked");
        await fs.mkdir(unpackDir);
        await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

        const root = path.join(unpackDir, result.prefix);
        const binary = path.join(root, "bin", "meshdrop-desktop");
        const appDir = path.join(root, "app");
        const initScript = path.join(tempDir, "init.js");
        await fs.writeFile(initScript, `
            globalThis.__meshdropNativeSmoke = {errors: [], rejections: []};
            globalThis.__meshdropE2E = {config: null, configLoaded: false};
            window.addEventListener("config", event => {
                globalThis.__meshdropE2E.config = event.detail;
                globalThis.__meshdropE2E.configLoaded = true;
            });
            window.addEventListener("error", event => {
                globalThis.__meshdropNativeSmoke.errors.push(String(event.message || event.error));
            });
            window.addEventListener("unhandledrejection", event => {
                globalThis.__meshdropNativeSmoke.rejections.push(String(event.reason?.message || event.reason));
            });
        `);

        driver = await startDriver(await reservePort());
        const session = await createSession(driver, {
            binary,
            args: ["--automation", "--app-dir", appDir, "--automation-init-script", initScript]
        });

        await waitFor(session, () => `
            return !!(
                globalThis.__meshdropE2E?.configLoaded
                || globalThis.meshdropNostrMesh
            );
        `, 30000);
        const state = await execute(session, `
            return {
                targetManifest: globalThis.__meshdropTargetManifest,
                config: globalThis.__meshdropE2E?.config?.capabilities || null,
                rtc: {
                    RTCPeerConnection: typeof RTCPeerConnection,
                    RTCDataChannel: typeof RTCDataChannel,
                    isRtcSupported: window.isRtcSupported
                },
                smoke: globalThis.__meshdropNativeSmoke
            };
        `);

        assert(state.targetManifest?.target === "desktop", "native shell did not inject desktop target manifest");
        assert(state.targetManifest?.nativeShellBuilt === true, "native shell manifest did not mark nativeShellBuilt");
        assert(state.config?.runtime?.target === "desktop", "native runtime did not report desktop target");
        assert(state.config?.runtime?.platform === "desktop", "native runtime did not report desktop platform");
        assert(state.config?.runtime?.hasBackend === false, "native runtime must not claim a backend");
        assert(state.config?.transports?.webrtc?.supported === false, "GTK/WebKit native shell must not claim WebRTC support");
        assert(state.rtc.RTCPeerConnection === "undefined", "GTK/WebKit unexpectedly exposed RTCPeerConnection");
        assert(state.rtc.RTCDataChannel === "undefined", "GTK/WebKit unexpectedly exposed RTCDataChannel");
        assert(state.rtc.isRtcSupported === false, "MeshDrop runtime should gate WebRTC off in GTK/WebKit");
        assert((state.smoke?.errors || []).length === 0, `native shell page errors:\n${state.smoke.errors.join("\n")}`);
        assert(
            (state.smoke?.rejections || []).filter(message => message !== "undefined").length === 0,
            `native shell unhandled rejections:\n${state.smoke.rejections.join("\n")}`
        );

        console.log("Proof desktop-native-runtime: packaged GTK/WebKit shell reports desktop runtime and gates WebRTC off");
    }
    finally {
        if (driver) await stopDriver(driver);
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function startDriver(port) {
    const process = spawn("WebKitWebDriver", ["-p", String(port)], {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    process.stderr.on("data", chunk => {
        stderr += chunk;
    });
    const exited = new Promise(resolve => process.on("exit", resolve));

    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/status`, {signal: AbortSignal.timeout(1000)});
            if (response.ok) return {port, process, exited, stderr: () => stderr};
        } catch {
            await delay(250);
        }
    }

    process.kill("SIGTERM");
    throw new Error(`WebKitWebDriver did not listen on ${port}:\n${stderr}`);
}

async function reservePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            server.close(error => {
                if (error) reject(error);
                else resolve(address.port);
            });
        });
    });
}

async function stopDriver(driver) {
    if (driver.process.exitCode !== null) return;

    killDriver(driver, "SIGTERM");
    const stopped = await Promise.race([
        driver.exited,
        delay(3000).then(() => false)
    ]);
    if (stopped !== false || driver.process.exitCode !== null) return;

    killDriver(driver, "SIGKILL");
    await Promise.race([driver.exited, delay(1000)]);
}

async function createSession(driver, browserOptions) {
    const response = await webdriverFetch(driver, "/session", {
        method: "POST",
        body: {
            capabilities: {
                alwaysMatch: {
                    browserName: "MeshDrop",
                    "webkitgtk:browserOptions": browserOptions
                }
            }
        },
        timeoutMs: 20000
    });
    const sessionId = response.value?.sessionId;
    assert(sessionId, `WebKitWebDriver did not return a session id:\n${JSON.stringify(response)}`);
    return {driver, id: sessionId};
}

function killDriver(driver, signal) {
    try {
        globalThis.process.kill(-driver.process.pid, signal);
    } catch {
        driver.process.kill(signal);
    }
}

async function waitFor(session, scriptFactory, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const value = await execute(session, scriptFactory());
            if (value) return value;
        } catch (error) {
            lastError = error;
        }
        await delay(250);
    }

    throw lastError || new Error(`Timed out after ${timeoutMs}ms`);
}

async function execute(session, script, args = []) {
    const response = await webdriverFetch(session.driver, `/session/${session.id}/execute/sync`, {
        method: "POST",
        body: {script, args},
        timeoutMs: 10000
    });
    return response.value;
}

async function webdriverFetch(driver, route, options) {
    const response = await fetch(`http://127.0.0.1:${driver.port}${route}`, {
        method: options.method,
        headers: {"content-type": "application/json"},
        body: JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs)
    });
    const body = await response.text();
    const parsed = body ? JSON.parse(body) : {value: null};

    if (!response.ok) {
        throw new Error(`WebDriver ${route} failed ${response.status}: ${body}\n${driver.stderr()}`);
    }

    return parsed;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
