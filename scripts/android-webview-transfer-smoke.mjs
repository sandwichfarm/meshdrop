import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {finalizeEvent} from "nostr-tools/pure";

import {
    androidMainActivity,
    buildAndExtractDebugApk,
    installAndLaunchDebugApk,
    prepareAndroidDevice,
    run,
    sleep
} from "./android-apk-runtime-utils.mjs";
import {connectAndroidWebView, evaluate} from "./android-webview-devtools.mjs";
import {
    addBrowserInitScript,
    androidDebugState,
    browserDebugState,
    createAndroidCallerIdentityPair,
    initScriptSource,
    watchBrowserPage
} from "./android-webview-transfer-harness.mjs";
import {buildMobilePackage} from "./build-mobile-package.mjs";
import {startFakeRelay} from "./fake-nostr-relay.mjs";
import {installProofSigner, loadPlaywright, startStaticServer} from "./spa-smoke-support.mjs";

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const hydrationTimeoutMs = 30000;
const transferTimeoutMs = 45000;
const proofFileName = "meshdrop-android-webview-proof.txt";
const proofText = "native-android-webview-nostr-webrtc";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-webview-transfer-smoke-"));
let device = null;
let webview = null;
let browser = null;
let browserContext = null;
let relay = null;
let server = null;
let reversedRelayPort = "";

try {
    progress("start fake relay");
    relay = await startFakeRelay();
    const relayPort = new URL(relay.url).port;
    progress("prepare Android device");
    device = await prepareAndroidDevice(process.env);
    progress("reverse fake relay port into emulator");
    await run(device.adb, ["-s", device.serial, "reverse", `tcp:${relayPort}`, `tcp:${relayPort}`]);
    reversedRelayPort = relayPort;

    progress("build and install debug APK");
    const {apkPath} = await buildAndExtractDebugApk({
        version: "0.0.0-webview-transfer-smoke",
        outDir: path.join(tempDir, "apk"),
        sdkRoot: device.sdkRoot
    });
    await installAndLaunchDebugApk(device.adb, device.serial, apkPath);

    progress("build browser peer artifact");
    const artifact = await buildMobilePackage({
        target: "android",
        version: "0.0.0-webview-transfer-smoke",
        outDir: path.join(tempDir, "browser-peer"),
        env: {
            ...process.env,
            MESH_DROP_BUILD_ID: "android-webview-transfer-browser-peer"
        }
    });
    const unpackDir = path.join(tempDir, "browser-peer", "unpacked");
    await fs.mkdir(unpackDir, {recursive: true});
    await run("tar", ["-xzf", artifact.artifactPath, "-C", unpackDir]);
    server = await startStaticServer(path.join(unpackDir, artifact.prefix));

    progress("launch Chromium peer");
    const playwright = await loadPlaywright(playwrightModulePath);
    browser = await playwright.chromium.launch({
        headless: true,
        args: [
            "--disable-features=WebRtcHideLocalIpsWithMdns",
            "--force-webrtc-ip-handling-policy=default_public_and_private_interfaces"
        ],
        ...(chromiumExecutablePath ? {executablePath: chromiumExecutablePath} : {})
    });
    browserContext = await browser.newContext({
        serviceWorkers: "block",
        isMobile: true,
        viewport: {width: 412, height: 915},
        userAgent: "MeshDropAndroidWebViewTransferPeer/Chromium Mobile"
    });
    const browserPeer = await browserContext.newPage();
    const browserErrors = watchBrowserPage("android-webview-transfer:browser", browserPeer);
    const androidErrors = [];
    const identities = createAndroidCallerIdentityPair();

    await installProofSigner(browserPeer, identities.b);
    await addBrowserInitScript(browserPeer, identities.b, [relay.url]);
    progress("attach Android WebView DevTools");
    webview = await connectAndroidWebView(device.adb, device.serial);
    await prepareAndroidCdp(webview.cdp, identities.a, androidErrors);

    progress("load peers");
    await browserPeer.goto(`http://127.0.0.1:${server.port}/app/`, {waitUntil: "domcontentloaded"});
    progress("wait for hydration");
    await Promise.all([
        waitForBrowserHydration(browserPeer, "browser receiver"),
        waitForAndroidBaseRuntime(webview.cdp)
    ]);
    await installAndroidHarness(webview.cdp, identities.a, [`ws://127.0.0.1:${relayPort}`]);
    await Promise.all([
        installBrowserProofIdentityHook(browserPeer),
        installAndroidProofIdentityHook(webview.cdp)
    ]);
    progress("connect Nostr identities");
    await Promise.all([
        connectBrowserNostr(browserPeer),
        connectAndroidNostr(webview.cdp)
    ]);
    await Promise.all([
        restoreBrowserFollowList(browserPeer),
        restoreAndroidFollowList(webview.cdp)
    ]);
    progress("connect Nostr mesh");
    await Promise.all([
        browserPeer.evaluate(() => globalThis.meshdropNostrMesh.connect()),
        evaluate(webview.cdp, "globalThis.meshdropNostrMesh.connect()", {awaitPromise: true})
    ]);
    await Promise.all([
        browserPeer.waitForFunction(() => globalThis.meshdropNostrMesh._active),
        waitForAndroidCondition(webview.cdp, "globalThis.meshdropNostrMesh?._active === true")
    ]);
    await Promise.all([
        waitForBrowserRelayOpen(browserPeer),
        waitForAndroidRelayOpen(webview.cdp)
    ]);
    await Promise.all([
        restoreBrowserFollowList(browserPeer),
        restoreAndroidFollowList(webview.cdp)
    ]);
    await Promise.all([
        browserPeer.evaluate(() => globalThis.meshdropNostrMesh._publishPresence("connect")),
        evaluate(webview.cdp, `(() => {
            globalThis.__meshdropRestoreProofFollowList();
            return globalThis.meshdropNostrMesh._publishPresence("connect");
        })()`, {awaitPromise: true})
    ]);

    progress("wait for peers");
    const androidPeerId = await waitForAndroidVisiblePeer(webview.cdp, "nostr");
    try {
        await waitForBrowserConnectedPeer(browserPeer, "nostr");
    }
    catch (error) {
        throw new Error(`${error.message}\nAndroid state:\n${JSON.stringify(await androidDebugState(webview.cdp), null, 2)}`, {
            cause: error
        });
    }
    progress("send proof file");
    await sendAndroidProofFile(webview.cdp, androidPeerId);
    const received = await waitForBrowserReceivedFiles(browserPeer);

    assert.equal(received[0]?.name, proofFileName);
    assert.equal(received[0]?.text, proofText);
    assert.deepEqual(androidErrors, []);
    assert.deepEqual(browserErrors, []);

    console.log(
        `Proof android-webview-nostr-webrtc: ${androidMainActivity} delivered ${proofFileName} ` +
        `to Chromium peer through local fake relay on ${device.serial}`
    );
}
finally {
    progress("cleanup");
    if (browserContext) await browserContext.close();
    if (browser) await browser.close();
    if (webview) await webview.close();
    if (reversedRelayPort && device) {
        await run(device.adb, ["-s", device.serial, "reverse", "--remove", `tcp:${reversedRelayPort}`]).catch(() => {});
    }
    if (device) await device.shutdown();
    if (server) await new Promise(resolve => server.close(resolve));
    if (relay) await new Promise(resolve => relay.close(resolve));
    await fs.rm(tempDir, {recursive: true, force: true});
}

function progress(step) {
    console.error(`[android-webview-transfer] ${step}`);
}

async function prepareAndroidCdp(cdp, identity, errors) {
    await cdp.send("Runtime.enable");
    await cdp.send("Runtime.addBinding", {name: "__meshdropCdpSignEvent"});
    cdp.on("Runtime.bindingCalled", params => {
        if (params.name !== "__meshdropCdpSignEvent") return;
        signAndroidEvent(cdp, identity, params.payload).catch(error => errors.push(error.message));
    });
    cdp.on("Runtime.exceptionThrown", params => {
        errors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "Android runtime exception");
    });
    cdp.on("Runtime.consoleAPICalled", params => {
        if (params.type !== "error") return;
        errors.push(params.args.map(arg => arg.value || arg.description || "").join(" "));
    });
}

async function signAndroidEvent(cdp, identity, payload) {
    const {id, event} = JSON.parse(payload);
    const signedEvent = finalizeEvent({
        ...event,
        pubkey: identity.pubkey
    }, identity.secretKey);
    await evaluate(cdp, `globalThis.__meshdropResolveSignedEvent(${JSON.stringify(id)}, ${JSON.stringify(signedEvent)})`, {
        awaitPromise: true
    });
}

async function installAndroidHarness(cdp, identity, relayUrls) {
    await evaluate(cdp, initScriptSource({
        identity: {
            pubkey: identity.pubkey,
            displayName: identity.displayName,
            followPubkeys: identity.followPubkeys
        },
        relayUrls,
        targetName: "android"
    }), {awaitPromise: true});
}

async function connectAndroidNostr(cdp) {
    await evaluate(cdp, `(() => {
        if (globalThis.meshdropNostrIdentity.getIdentity()) return true;
        return globalThis.meshdropNostrIdentity.connect().then(() => true);
    })()`, {awaitPromise: true});
}

async function connectBrowserNostr(page) {
    const hasIdentity = await page.evaluate(() => !!globalThis.meshdropNostrIdentity.getIdentity());
    if (hasIdentity) return;

    await page.evaluate(() => globalThis.meshdropNostrIdentity.connect());
    await page.waitForFunction(() => !!globalThis.meshdropNostrIdentity.getIdentity());
}

async function restoreAndroidFollowList(cdp) {
    await evaluate(cdp, `(() => {
        return globalThis.__meshdropRestoreProofFollowList();
    })()`);
}

async function restoreBrowserFollowList(page) {
    await page.evaluate(() => {
        globalThis.__meshdropRestoreProofFollowList();
    });
}

async function installAndroidProofIdentityHook(cdp) {
    await evaluate(cdp, proofIdentityHookSource(), {awaitPromise: true});
}

async function installBrowserProofIdentityHook(page) {
    await page.evaluate(proofIdentityHookSource());
}

function proofIdentityHookSource() {
    return `(() => {
        if (globalThis.__meshdropProofIdentityHookInstalled) return true;
        if (globalThis.meshdropNostrIdentity && !globalThis.__meshdropProofIdentityHookInstalled) {
            globalThis.meshdropNostrIdentity.hydrateIdentity = async () => {
                globalThis.__meshdropRestoreProofFollowList();
                return globalThis.meshdropNostrIdentity.getIdentity();
            };
            globalThis.__meshdropProofIdentityHookInstalled = true;
        }
        return globalThis.__meshdropProofIdentityHookInstalled === true;
    })()`;
}

async function waitForAndroidBaseRuntime(cdp) {
    await waitForAndroidCondition(cdp, `(
        globalThis.meshdropNostrIdentity
        && globalThis.meshdropNostrMesh
    )`, hydrationTimeoutMs);
}

async function waitForBrowserHydration(page, role) {
    try {
        await page.waitForFunction(() => (
            globalThis.__meshdropE2E?.configLoaded
            && globalThis.__meshdropE2E?.peersManager
            && globalThis.meshdropNostrIdentity
            && globalThis.meshdropNostrMesh
        ), undefined, {timeout: hydrationTimeoutMs});
    }
    catch (error) {
        throw new Error(`${role} hydration failed: ${error.message}`);
    }
}

async function waitForAndroidVisiblePeer(cdp, roomType) {
    return waitForAndroidValue(cdp, `(() => {
        const peer = document.querySelector("x-peer.type-${roomType}");
        if (!peer) return "";
        return peer.id;
    })()`, 30000);
}

async function waitForBrowserConnectedPeer(page, roomType) {
    try {
        const handle = await page.waitForFunction(type => {
            const peer = document.querySelector(`x-peer.type-${type}`);
            if (!peer) return "";
            if (!globalThis.__meshdropE2E.connected.includes(peer.id)) return "";
            return peer.id;
        }, roomType, {timeout: 90000});
        return handle.jsonValue();
    }
    catch (error) {
        throw new Error(`${error.message}\n${JSON.stringify(await browserDebugState(page), null, 2)}`, {cause: error});
    }
}

async function waitForBrowserRelayOpen(page) {
    await page.waitForFunction(() => {
        const sockets = [...(globalThis.meshdropNostrMesh?._sockets?.values() || [])];
        return sockets.length > 0 && sockets.every(socket => socket.readyState === WebSocket.OPEN);
    }, undefined, {timeout: 30000});
}

async function waitForAndroidRelayOpen(cdp) {
    await waitForAndroidCondition(cdp, `(() => {
        const sockets = [...(globalThis.meshdropNostrMesh?._sockets?.values() || [])];
        return sockets.length > 0 && sockets.every(socket => socket.readyState === WebSocket.OPEN);
    })()`, 30000);
}

async function sendAndroidProofFile(cdp, peerId) {
    await evaluate(cdp, `(() => {
        const file = new File([${JSON.stringify(proofText)}], ${JSON.stringify(proofFileName)}, {type: "text/plain"});
        window.dispatchEvent(new CustomEvent("files-selected", {
            detail: {to: ${JSON.stringify(peerId)}, files: [file]}
        }));
        return true;
    })()`);
}

async function waitForBrowserReceivedFiles(page) {
    const handle = await page.waitForFunction(() => {
        const batch = globalThis.__meshdropE2E.received.at(-1);
        if (!batch || batch.files.length !== 1) return null;
        return batch.files;
    }, undefined, {timeout: transferTimeoutMs});
    return handle.jsonValue();
}

async function waitForAndroidCondition(cdp, expression, timeoutMs = 30000) {
    await waitForAndroidValue(cdp, `(() => ${expression} ? true : null)()`, timeoutMs);
}

async function waitForAndroidValue(cdp, expression, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastState = null;
    while (Date.now() < deadline) {
        const value = await evaluate(cdp, expression, {awaitPromise: true});
        if (value) return value;
        lastState = await androidDebugState(cdp);
        await sleep(500);
    }
    throw new Error(`Timed out waiting for Android WebView condition\n${JSON.stringify(lastState, null, 2)}`);
}
