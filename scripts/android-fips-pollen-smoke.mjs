import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    androidMainActivity,
    buildAndExtractDebugApk,
    installAndLaunchDebugApk,
    prepareAndroidDevice
} from "./android-apk-runtime-utils.mjs";
import {connectAndroidWebView, evaluate} from "./android-webview-devtools.mjs";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-fips-pollen-smoke-"));
const expectAndroidPln = Object.keys(process.env).some(key => key.startsWith("MESHDROP_ANDROID_PLN_"));
let device = null;
let webview = null;

try {
    device = await prepareAndroidDevice(process.env);
    const {apkPath} = await buildAndExtractDebugApk({
        version: "0.0.0-android-fips-pollen-smoke",
        outDir: tempDir,
        sdkRoot: device.sdkRoot
    });
    await installAndLaunchDebugApk(device.adb, device.serial, apkPath);

    webview = await connectAndroidWebView(device.adb, device.serial);
    await webview.cdp.send("Runtime.enable");
    const state = await waitForNativeBackendState(webview.cdp);

    assert.equal(state.backendAlive, true);
    assert.match(state.backendBaseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(state.fipsSupported, true);
    assert.equal(state.pollenSupported, true);
    assert.equal(state.fipsHidden, false);
    assert.equal(state.pollenHidden, false);
    assert.equal(state.fipsStatus.enabled, true);
    assert.equal(state.fipsStatus.available, true);
    assert.equal(state.fipsStatus.backend, "android-native");
    assert.equal(state.fipsStatus.rustCore, false);
    assert.equal(state.fipsStatus.error, "rust-fips-core-not-linked");
    assert.equal(state.pollenStatus.enabled, true);
    assert.equal(state.pollenStatus.available, true);
    assert.equal(state.pollenStatus.backend, expectAndroidPln ? "android-native-pln" : "android-native");
    if (expectAndroidPln) {
        assert.equal(state.pollenStatus.substrate, "pln");
        assert.equal(state.pollenStatus.pln, true);
        assert.equal(state.pollenStatus.wasmRuntime, true);
    }
    assert.equal(state.pollenRoundTripText, "android-native-pollen-proof");
    assert.equal(state.pollenDescriptor.size, "android-native-pollen-proof".length);
    assert.match(state.pollenDescriptor.hash, /^[0-9a-f]{64}$/);

    console.log(
        `Proof android-fips-pollen: ${androidMainActivity} served ` +
        `FIPS status from ${state.fipsStatus.backend} with rustCore=${state.fipsStatus.rustCore}, ` +
        `Pollen ${state.pollenStatus.backend} uploaded/downloaded ${state.pollenDescriptor.hash} ` +
        `via ${state.backendBaseUrl} on ${device.serial}`
    );
}
finally {
    if (webview) await webview.close();
    if (device) await device.shutdown();
    await fs.rm(tempDir, {recursive: true, force: true});
}

async function waitForNativeBackendState(cdp) {
    for (let i = 0; i < 80; i += 1) {
        const state = await evaluate(cdp, `(${nativeBackendProbe.toString()})()`, {awaitPromise: true});
        if (
            state.readyState !== "loading" &&
            state.backendAlive === true &&
            state.fipsSupported === true &&
            state.pollenSupported === true &&
            state.fipsStatus?.available === true &&
            state.pollenStatus?.available === true &&
            state.pollenRoundTripText === "android-native-pollen-proof"
        ) {
            return state;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    const state = await evaluate(cdp, `(${nativeBackendProbe.toString()})()`, {awaitPromise: true});
    throw new Error(`Timed out waiting for Android native FIPS/Pollen backend proof: ${JSON.stringify(state)}`);
}

async function nativeBackendProbe() {
    const manifest = globalThis.__meshdropTargetManifest || {};
    const backend = globalThis.__meshdropAndroidNativeBackend || {};
    const staticConfig = globalThis.RuntimeCapabilities
        ? globalThis.RuntimeCapabilities.staticConfig(manifest)
        : null;
    const backendBaseUrl = backend.baseUrl || "";
    const fipsStatus = backendBaseUrl
        ? await fetch(`${backendBaseUrl}/fips/status`).then(response => response.json())
        : null;
    const pollenStatus = backendBaseUrl
        ? await fetch(`${backendBaseUrl}/pollen/status`).then(response => response.json())
        : null;
    const file = new File(["android-native-pollen-proof"], "android-native-pollen-proof.txt", {type: "text/plain"});
    let pollenDescriptor = null;
    let pollenRoundTripText = "";
    let pollenTransferError = "";
    try {
        pollenDescriptor = globalThis.meshdropPollenTransfer && backendBaseUrl
            ? await globalThis.meshdropPollenTransfer.uploadFile(file)
            : null;
        const pollenFile = pollenDescriptor && globalThis.meshdropPollenTransfer
            ? await globalThis.meshdropPollenTransfer.downloadDescriptor(pollenDescriptor, {
                name: "android-native-pollen-proof.txt",
                mime: "text/plain"
            })
            : null;
        pollenRoundTripText = pollenFile ? await pollenFile.text() : "";
    } catch (error) {
        pollenTransferError = error.message;
    }

    return {
        readyState: document.readyState,
        backendAlive: backend.alive === true,
        backendBaseUrl,
        manifestBackend: manifest.runtime?.hasBackend === true,
        fipsSupported: staticConfig?.capabilities?.transports?.fips?.supported,
        pollenSupported: staticConfig?.capabilities?.transports?.pollen?.supported,
        fipsHidden: document.getElementById("fips-discovery")?.hasAttribute("hidden"),
        pollenHidden: document.getElementById("pollen-transfer")?.hasAttribute("hidden"),
        fipsStatus,
        pollenStatus,
        pollenTransferError,
        pollenDescriptor,
        pollenRoundTripText
    };
}
