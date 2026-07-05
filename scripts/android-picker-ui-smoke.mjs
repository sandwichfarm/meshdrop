import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    androidMainActivity,
    buildAndExtractDebugApk,
    installAndLaunchDebugApk,
    prepareAndroidDevice,
    run,
    sleep,
    stripCarriageReturns
} from "./android-apk-runtime-utils.mjs";
import {connectAndroidWebView, evaluate} from "./android-webview-devtools.mjs";

const proofFileName = "meshdrop-picker-proof.txt";
const proofText = "native-android-picker-ui-proof";
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-picker-ui-smoke-"));

let device = null;
let webview = null;

try {
    progress("prepare Android device");
    device = await prepareAndroidDevice(process.env);

    progress("build and install debug APK");
    const {apkPath} = await buildAndExtractDebugApk({
        version: "0.0.0-picker-ui-smoke",
        outDir: path.join(tempDir, "apk"),
        sdkRoot: device.sdkRoot
    });
    await installAndLaunchDebugApk(device.adb, device.serial, apkPath);

    progress("seed Android Downloads file");
    await seedDownloadFile(device);

    progress("attach Android WebView DevTools");
    webview = await connectAndroidWebView(device.adb, device.serial);
    await webview.cdp.send("Runtime.enable");
    await webview.cdp.send("Input.setIgnoreInputEvents", {ignore: false});
    await bringMeshDropToForeground(device.adb, device.serial);
    await waitForAndroidCondition(webview.cdp, "document.readyState === 'complete' || document.readyState === 'interactive'");

    progress("click WebView file input");
    const point = await installAndLocatePickerInput(webview.cdp);
    await tapWebViewPoint(device.adb, device.serial, point, webview.cdp);

    progress("wait for native picker UI");
    const pickerActivity = await waitForTopActivity(device.adb, device.serial, /documentsui|resolver|file/i);
    assert.match(pickerActivity, /ACTIVITY/i);

    progress("select seeded picker file");
    await tapPickerFile(device.adb, device.serial, proofFileName);

    progress("wait for picker result in WebView");
    const result = await waitForAndroidValue(webview.cdp, `globalThis.__meshdropPickerProof?.file`, 30000);
    assert.equal(result.name, proofFileName);
    assert.equal(result.text, proofText);
    assert(result.size >= proofText.length);

    const topActivity = await run(device.adb, ["-s", device.serial, "shell", "dumpsys", "activity", "top"]);
    assert.match(stripCarriageReturns(topActivity.stdout), new RegExp(`ACTIVITY ${androidMainActivity.replace("/", "\\/")}`));

    console.log(
        `Proof android-picker-ui: native picker UI selected ${proofFileName} and returned it to ` +
        `${androidMainActivity} on ${device.serial}`
    );
}
finally {
    progress("cleanup");
    if (webview) await webview.close();
    if (device) await device.shutdown();
    await fs.rm(tempDir, {recursive: true, force: true});
}

function progress(step) {
    console.error(`[android-picker-ui] ${step}`);
}

async function seedDownloadFile(device) {
    const localFile = path.join(tempDir, proofFileName);
    await fs.writeFile(localFile, proofText);
    for (const directory of ["/sdcard", "/sdcard/Download", "/sdcard/Documents"]) {
        await run(device.adb, ["-s", device.serial, "shell", "mkdir", "-p", directory]);
        const remoteFile = `${directory}/${proofFileName}`;
        await run(device.adb, ["-s", device.serial, "push", localFile, remoteFile]);
        await indexMediaFile(device.adb, device.serial, remoteFile);
    }
}

async function indexMediaFile(adb, serial, remoteFile) {
    await run(adb, ["-s", serial, "shell", "cmd", "media", "scan-file", remoteFile], {timeoutMs: 10000})
        .catch(() => run(adb, [
            "-s", serial, "shell", "am", "broadcast",
            "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
            "-d", `file://${remoteFile}`
        ], {timeoutMs: 10000}))
        .catch(() => {});
}

async function bringMeshDropToForeground(adb, serial) {
    await run(adb, ["-s", serial, "shell", "am", "start", "-W", "-n", androidMainActivity], {timeoutMs: 30000});
    const deadline = Date.now() + 10000;
    let activity = "";
    while (Date.now() < deadline) {
        activity = await topActivityLine(adb, serial);
        if (activity.includes(androidMainActivity)) return;
        await sleep(500);
    }
    assert.fail(`MeshDrop not foreground before picker tap: ${activity}`);
}

async function installAndLocatePickerInput(cdp) {
    return evaluate(cdp, `(() => {
        let input = document.querySelector("#meshdrop-picker-proof-input");
        if (!input) {
            input = document.createElement("input");
            input.id = "meshdrop-picker-proof-input";
            input.type = "file";
            input.accept = "text/plain";
            input.style.position = "fixed";
            input.style.left = "24px";
            input.style.top = "24px";
            input.style.width = "220px";
            input.style.height = "80px";
            input.style.opacity = "1";
            input.style.zIndex = "2147483647";
            input.style.background = "white";
            document.body.appendChild(input);
        }
        globalThis.__meshdropPickerProof = {file: null};
        input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            globalThis.__meshdropPickerProof.file = {
                name: file.name,
                size: file.size,
                type: file.type,
                text: await file.text()
            };
        };
        const rect = input.getBoundingClientRect();
        return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            devicePixelRatio: window.devicePixelRatio || 1
        };
    })()`);
}

async function tapWebViewPoint(adb, serial, point, cdp) {
    const xml = await dumpUiHierarchy(adb, serial);
    const bounds = findBounds(xml, "android.webkit.WebView");
    if (!bounds) {
        await dispatchWebViewClick(cdp, point);
        return;
    }
    const x = bounds.left + Math.round(point.x * point.devicePixelRatio);
    const y = bounds.top + Math.round(point.y * point.devicePixelRatio);
    await run(adb, ["-s", serial, "shell", "input", "tap", String(x), String(y)]);
}

async function dispatchWebViewClick(cdp, point) {
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: point.x,
        y: point.y,
        button: "left",
        clickCount: 1
    });
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: point.x,
        y: point.y,
        button: "left",
        clickCount: 1
    });
}

async function waitForTopActivity(adb, serial, pattern) {
    const deadline = Date.now() + 30000;
    let activity = "";
    while (Date.now() < deadline) {
        activity = await topActivityLine(adb, serial);
        if (pattern.test(activity)) return activity;
        await sleep(500);
    }
    throw new Error(`Timed out waiting for native picker UI. Last activity: ${activity}`);
}

async function tapPickerFile(adb, serial, fileName) {
    for (let i = 0; i < 8; i += 1) {
        if (await tapVisiblePickerFile(adb, serial, fileName)) return;
        await sleep(750);
    }

    await openDownloadsRoot(adb, serial);
    for (let i = 0; i < 12; i += 1) {
        if (await tapVisiblePickerFile(adb, serial, fileName)) return;
        await scrollPicker(adb, serial);
        await sleep(500);
    }
    const xml = await dumpUiHierarchy(adb, serial).catch(error => `Could not dump picker UI: ${error.message}`);
    throw new Error(`Could not select ${fileName} from native picker UI\n${xml}`);
}

async function openDownloadsRoot(adb, serial) {
    for (const rootLabel of ["Downloads", "Documents", "sdk_gphone64_x86_64"]) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            await openPickerDrawer(adb, serial);
            if (await tapUiNode(adb, serial, rootLabel)) {
                await sleep(1500);
                if (await pickerDrawerClosed(adb, serial)) return;
            }
            await sleep(750);
        }
    }
}

async function tapVisiblePickerFile(adb, serial, fileName) {
    if (!await tapUiNode(adb, serial, fileName)) return false;
    await sleep(1000);
    const activity = await topActivityLine(adb, serial);
    return activity.includes(androidMainActivity);
}

async function openPickerDrawer(adb, serial) {
    for (const label of ["Show roots", "Open navigation drawer"]) {
        if (await tapUiNode(adb, serial, label)) {
            await sleep(750);
            return;
        }
    }
}

async function pickerDrawerClosed(adb, serial) {
    const xml = await dumpUiHierarchy(adb, serial).catch(() => "");
    return !xml.includes("com.google.android.documentsui:id/drawer_roots");
}

async function tapUiNode(adb, serial, textOrDescription) {
    const xml = await dumpUiHierarchy(adb, serial);
    const node = findNode(xml, textOrDescription);
    if (!node) return false;
    await run(adb, ["-s", serial, "shell", "input", "tap", String(node.x), String(node.y)]);
    return true;
}

async function scrollPicker(adb, serial) {
    await run(adb, ["-s", serial, "shell", "input", "swipe", "500", "1500", "500", "600", "250"]);
}

async function dumpUiHierarchy(adb, serial) {
    const remotePath = "/data/local/tmp/meshdrop-window.xml";
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const dumped = await run(adb, ["-s", serial, "shell", "uiautomator", "dump", remotePath], {timeoutMs: 10000})
            .catch(error => {
                lastError = error.message;
                return null;
            });
        const read = await run(adb, ["-s", serial, "shell", "cat", remotePath]).catch(error => {
            lastError = `${dumped?.stdout || ""}\n${dumped?.stderr || ""}\n${error.message}`;
            return null;
        });
        if (read?.stdout) return stripCarriageReturns(read.stdout);
        await sleep(500);
    }
    throw new Error(`Could not dump Android UI hierarchy from ${remotePath}\n${lastError}`);
}

function findNode(xml, needle) {
    const escaped = escapeRegExp(needle);
    const patterns = [
        new RegExp(`<node\\b[^>]*text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, "i"),
        new RegExp(`<node\\b[^>]*text="[^"]*${escaped}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, "i"),
        new RegExp(`<node\\b[^>]*content-desc="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, "i"),
        new RegExp(`<node\\b[^>]*content-desc="[^"]*${escaped}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, "i")
    ];
    const match = patterns.map(pattern => xml.match(pattern)).find(Boolean);
    if (!match) return null;
    const [, left, top, right, bottom] = match.map(Number);
    return {
        x: Math.round((left + right) / 2),
        y: Math.round((top + bottom) / 2)
    };
}

function findBounds(xml, className) {
    const pattern = new RegExp(`<node\\b[^>]*class="${escapeRegExp(className)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, "i");
    const match = xml.match(pattern);
    if (!match) return null;
    const [, left, top, right, bottom] = match.map(Number);
    return {left, top, right, bottom};
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function topActivityLine(adb, serial) {
    const {stdout} = await run(adb, ["-s", serial, "shell", "dumpsys", "activity", "activities"]);
    const lines = stripCarriageReturns(stdout).split("\n");
    return lines.find(line => line.includes("topResumedActivity="))
        || lines.find(line => line.includes("mResumedActivity:"))
        || lines.find(line => line.includes("ACTIVITY "))
        || "";
}

async function waitForAndroidCondition(cdp, expression, timeoutMs = 30000) {
    await waitForAndroidValue(cdp, `(() => ${expression} ? true : null)()`, timeoutMs);
}

async function waitForAndroidValue(cdp, expression, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastValue = null;
    while (Date.now() < deadline) {
        const value = await evaluate(cdp, expression, {awaitPromise: true});
        if (value) return value;
        lastValue = value;
        await sleep(500);
    }
    throw new Error(`Timed out waiting for Android WebView value: ${expression}\nLast value: ${JSON.stringify(lastValue)}`);
}
