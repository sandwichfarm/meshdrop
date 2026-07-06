import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";

import {
    androidMainActivity,
    androidPackageName,
    buildAndExtractDebugApk,
    installAndLaunchDebugApk,
    prepareAndroidDevice,
    run,
    sleep,
    stripCarriageReturns
} from "./android-apk-runtime-utils.mjs";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-webview-capability-smoke-"));
let device = null;
let forwardedPort = "";

try {
    device = await prepareAndroidDevice(process.env);
    const {apkPath} = await buildAndExtractDebugApk({
        version: "0.0.0-webview-capability-smoke",
        outDir: tempDir,
        sdkRoot: device.sdkRoot
    });
    await installAndLaunchDebugApk(device.adb, device.serial, apkPath);

    const socket = await findWebViewDevtoolsSocket(device.adb, device.serial);
    forwardedPort = await forwardDevtools(device.adb, device.serial, socket);
    const webSocketUrl = await findPageDebuggerUrl(forwardedPort);
    const cdp = await connectCdp(webSocketUrl);

    try {
        await cdp.send("Runtime.enable");
        const state = await waitForRuntimeState(cdp);
        assert.equal(state.locationProtocol, "file:");
        assert.equal(state.manifestTarget, "android");
        assert.equal(state.nativeShellBuilt, true);
        assert.equal(state.runtimeTarget, "android");
        assert.equal(state.nativeBackendAlive, true);
        assert.match(state.nativeBackendBaseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
        assert.equal(state.staticRuntimeHasBackend, false);
        assert.equal(state.claimsNativeWebRtc, true);
        assert.equal(state.rtcPeerConnection, "function");
        assert.equal(state.webSocket, "function");
        assert.equal(state.fipsSupported, true);
        assert.equal(state.pollenSupported, true);
        assert.equal(state.fipsHidden, false);
        assert.equal(state.pollenHidden, false);
        assert.equal(state.dataChannelLabel, "meshdrop-probe");
        assert.equal(state.dataChannelError, "");
        assert.equal(state.runtimeBluetooth.supported, false);
        assert.equal(state.runtimeBluetooth.transferSupported, false);
        assert.equal(state.runtimeBluetooth.requiresBackend, false);
        assert.equal(state.runtimeBluetooth.requiresNativeShell, false);
        assert.equal(state.runtimeBluetooth.apiAvailable, state.bluetoothApiAvailable);
        assert.equal(state.runtimeBluetooth.nativeBridgeAvailable, false);
        assert.equal(state.runtimeBluetooth.requiresAdapter, true);
        assert.equal(state.runtimeBluetooth.unavailableReason, "bluetooth-transfer-not-implemented");

        console.log(
            `Proof android-webview-capabilities: ${androidMainActivity} exposed ` +
            `RTCPeerConnection=${state.rtcPeerConnection}, WebSocket=${state.webSocket}, ` +
            `RTCDataChannel label=${state.dataChannelLabel}, manifest target=${state.manifestTarget}, ` +
            `native backend=${state.nativeBackendBaseUrl}, ` +
            `native transfer claim=${state.claimsNativeWebRtc}, ` +
            `FIPS visible=${!state.fipsHidden}, Pollen visible=${!state.pollenHidden}, ` +
            `Bluetooth API=${state.webBluetoothApi}, Bluetooth transfer=${state.runtimeBluetooth.transferSupported} ` +
            `on ${device.serial}`
        );
    }
    finally {
        cdp.close();
    }
}
finally {
    if (forwardedPort && device) {
        await run(device.adb, ["-s", device.serial, "forward", "--remove", `tcp:${forwardedPort}`]).catch(() => {});
    }
    if (device) {
        await device.shutdown();
    }
    await fs.rm(tempDir, {recursive: true, force: true});
}

async function findWebViewDevtoolsSocket(adb, serial) {
    const pid = await findPackagePid(adb, serial);
    const preferredSocket = pid ? `webview_devtools_remote_${pid}` : "";

    for (let i = 0; i < 60; i += 1) {
        const {stdout} = await run(adb, ["-s", serial, "shell", "cat", "/proc/net/unix"]);
        const sockets = [...stdout.matchAll(/@?(webview_devtools_remote(?:_\d+)?)/g)].map(match => match[1]);
        if (preferredSocket && sockets.includes(preferredSocket)) {
            return preferredSocket;
        }
        if (sockets.length > 0) {
            return sockets[0];
        }
        await sleep(1000);
    }

    throw new Error(`Timed out waiting for Android WebView DevTools socket for ${androidPackageName}`);
}

async function findPackagePid(adb, serial) {
    try {
        const {stdout} = await run(adb, ["-s", serial, "shell", "pidof", androidPackageName]);
        return stripCarriageReturns(stdout).trim().split(/\s+/)[0] || "";
    }
    catch {
        return "";
    }
}

async function forwardDevtools(adb, serial, socket) {
    const {stdout} = await run(adb, ["-s", serial, "forward", "tcp:0", `localabstract:${socket}`]);
    return stripCarriageReturns(stdout).trim();
}

async function findPageDebuggerUrl(port) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find(target => target.type === "page" && target.url.startsWith("file:///android_asset/meshdrop/"));
    assert(page, "Android WebView DevTools did not expose the MeshDrop page target");
    assert(page.webSocketDebuggerUrl, "Android WebView target did not expose a debugger WebSocket URL");
    return page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://127.0.0.1:${port}`);
}

async function fetchJson(url) {
    let lastError = null;
    for (let i = 0; i < 30; i += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return response.json();
            }
        }
        catch (error) {
            lastError = error;
        }
        await sleep(500);
    }
    throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`);
}

function connectCdp(webSocketUrl) {
    const ws = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;

    ws.on("message", data => {
        const message = JSON.parse(data.toString());
        if (!message.id || !pending.has(message.id)) {
            return;
        }
        const {resolve, reject} = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
            reject(new Error(`${message.error.code}: ${message.error.message}`));
            return;
        }
        resolve(message.result);
    });

    return new Promise((resolve, reject) => {
        ws.once("open", () => {
            resolve({
                send(method, params = {}) {
                    const id = nextId;
                    nextId += 1;
                    return new Promise((sendResolve, sendReject) => {
                        pending.set(id, {resolve: sendResolve, reject: sendReject});
                        ws.send(JSON.stringify({id, method, params}));
                    });
                },
                close() {
                    ws.close();
                }
            });
        });
        ws.once("error", reject);
    });
}

async function waitForRuntimeState(cdp) {
    for (let i = 0; i < 30; i += 1) {
        const state = await evaluateRuntimeState(cdp);
        if (
            state.readyState !== "loading" &&
            state.manifestTarget === "android" &&
            state.nativeBackendAlive === true &&
            state.staticRuntimeHasBackend === false &&
            state.runtimeCapabilities === "object" &&
            state.fipsSupported === true &&
            state.pollenSupported === true &&
            state.fipsHidden === false &&
            state.pollenHidden === false
        ) {
            return state;
        }
        await sleep(500);
    }
    throw new Error("Timed out waiting for Android WebView runtime state");
}

async function evaluateRuntimeState(cdp) {
    const result = await cdp.send("Runtime.evaluate", {
        expression: `(() => {
            const manifest = globalThis.__meshdropTargetManifest || {};
            const runtimeCapabilities = typeof globalThis.RuntimeCapabilities;
            const runtimeBluetooth = globalThis.RuntimeCapabilities
                ? globalThis.RuntimeCapabilities.bluetoothCapabilities(manifest)
                : null;
            const staticConfig = globalThis.RuntimeCapabilities
                ? globalThis.RuntimeCapabilities.staticConfig(manifest)
                : null;
            let dataChannelLabel = "";
            let dataChannelError = "";
            try {
                const pc = new RTCPeerConnection({iceServers: []});
                const channel = pc.createDataChannel("meshdrop-probe");
                dataChannelLabel = channel.label;
                pc.close();
            }
            catch (error) {
                dataChannelError = error && error.name ? error.name : String(error);
            }
            return {
                readyState: document.readyState,
                locationProtocol: location.protocol,
                manifestTarget: manifest.target || "",
                nativeShellBuilt: manifest.nativeShellBuilt === true,
                runtimeTarget: manifest.runtime && manifest.runtime.target || "",
                nativeBackendAlive: globalThis.__meshdropAndroidNativeBackend?.alive === true,
                nativeBackendBaseUrl: globalThis.__meshdropAndroidNativeBackend?.baseUrl || "",
                staticRuntimeHasBackend: staticConfig?.capabilities?.runtime?.hasBackend,
                claimsNativeWebRtc: manifest.transports && manifest.transports.webrtc === true,
                runtimeCapabilities,
                rtcPeerConnection: typeof RTCPeerConnection,
                webSocket: typeof WebSocket,
                fipsSupported: staticConfig?.capabilities?.transports?.fips?.supported,
                pollenSupported: staticConfig?.capabilities?.transports?.pollen?.supported,
                fipsHidden: document.getElementById("fips-discovery")?.hasAttribute("hidden"),
                pollenHidden: document.getElementById("pollen-transfer")?.hasAttribute("hidden"),
                webBluetoothApi: typeof navigator.bluetooth,
                bluetoothApiAvailable: !!navigator.bluetooth,
                runtimeBluetooth,
                dataChannelLabel,
                dataChannelError,
                userAgent: navigator.userAgent
            };
        })()`,
        returnByValue: true
    });
    assert.equal(result.exceptionDetails, undefined, result.exceptionDetails?.text || "runtime evaluation failed");
    assert(result.result, "CDP Runtime.evaluate returned no result");
    return result.result.value;
}
