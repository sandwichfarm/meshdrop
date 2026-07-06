import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildSpaArtifact} from "./build-spa-artifact.mjs";
import {startFakeRelay} from "./fake-nostr-relay.mjs";
import {
    assert,
    createProofIdentity,
    createProofIdentityPair,
    delay,
    installProofSigner,
    loadPlaywright,
    parseRelayUrls,
    run,
    startStaticServer
} from "./spa-smoke-support.mjs";

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const browserTypeName = process.env.PLAYWRIGHT_BROWSER || "chromium";
const browserExecutablePaths = {
    chromium: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    firefox: process.env.PLAYWRIGHT_FIREFOX_PATH,
    webkit: process.env.PLAYWRIGHT_WEBKIT_PATH
};
const supportedBrowserTypes = ["chromium", "firefox", "webkit"];
const proofText = "backend-free-spa-nostr-webrtc";
const spaHydrationTimeoutMs = browserTypeName === "webkit" ? 90000 : 30000;
const webkitTransferRequested = process.env.MESHDROP_SPA_WEBKIT_TRANSFER === "1";
const defaultSmokeAttempts = browserTypeName === "webkit" ? 3 : 1;
const webkitTransferStrategies = webkitTransferRequested && browserTypeName === "webkit"
    ? [
        {name: "one-context-two-origins", singleBrowserContext: true},
        {name: "two-contexts-two-origins", singleBrowserContext: false},
        {name: "two-browsers-two-origins", separateBrowsers: true, singleBrowserContext: false}
    ]
    : Array.from({length: defaultSmokeAttempts}, () => ({name: "default", singleBrowserContext: false}));
const smokeAttempts = webkitTransferStrategies.length;
const runsBackendFreeTransferProof = browserTypeName !== "webkit" || webkitTransferRequested;
const publicRelayUrls = parseRelayUrls(process.env.MESHDROP_SPA_PUBLIC_RELAY_URLS || "");

async function main() {
    assert(
        supportedBrowserTypes.includes(browserTypeName),
        `PLAYWRIGHT_BROWSER must be one of ${supportedBrowserTypes.join(", ")}`
    );

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-spa-artifact-"));
    const result = await buildSpaArtifact({
        version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-smoke",
        outDir: tempDir,
        env: {
            ...process.env,
            MESH_DROP_BUILD_ID: "spa-smoke"
        }
    });
    const unpackDir = path.join(tempDir, "unpacked");
    await fs.mkdir(unpackDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

    const root = path.join(unpackDir, result.prefix);
    const server = await startStaticServer(root);
    const peerBServer = webkitTransferRequested ? await startStaticServer(root) : null;
    const relay = publicRelayUrls.length ? null : await startFakeRelay();
    const relayUrls = publicRelayUrls.length ? publicRelayUrls : [relay.url];

    try {
        const playwright = await loadPlaywright(playwrightModulePath);
        const browserType = playwright[browserTypeName];
        await retrySmoke(async attempt => {
            const browser = await launchBrowser(browserType);
            const strategy = webkitTransferStrategies[Math.min(attempt - 1, webkitTransferStrategies.length - 1)];
            try {
                if (!webkitTransferRequested || browserTypeName !== "webkit") {
                    await runRuntimeCapabilityProof(browser, server.port, relayUrls);
                }
                if (runsBackendFreeTransferProof) {
                    await runBackendFreeTransferProof(browser, server.port, relayUrls, {
                        peerBPort: peerBServer?.port,
                        browserType,
                        singleBrowserContext: strategy.singleBrowserContext,
                        separateBrowsers: strategy.separateBrowsers,
                        sequentialSetup: browserTypeName === "webkit",
                        strategyName: strategy.name
                    });
                } else {
                    console.log(
                        `Proof backend-free-spa-runtime:${browserTypeName}: packaged SPA boots without backend transports; `
                        + "set MESHDROP_SPA_WEBKIT_TRANSFER=1 to attempt WebKit transfer UAT"
                    );
                }
            }
            finally {
                await browser.close();
            }
        });

        console.log(`SPA artifact smoke passed for ${browserTypeName}: ${result.artifactPath}`);
    }
    finally {
        if (relay) await new Promise(resolve => relay.close(resolve));
        if (peerBServer) await new Promise(resolve => peerBServer.close(resolve));
        await new Promise(resolve => server.close(resolve));
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function launchBrowser(browserType) {
    const launchOptions = {headless: true};
    if (browserExecutablePaths[browserTypeName]) launchOptions.executablePath = browserExecutablePaths[browserTypeName];
    return browserType.launch(launchOptions);
}

async function retrySmoke(run) {
    let lastError = null;
    for (let attempt = 1; attempt <= smokeAttempts; attempt++) {
        try {
            return await run(attempt);
        } catch (error) {
            lastError = error;
            if (attempt === smokeAttempts) break;
            console.warn(`${browserTypeName} SPA smoke attempt ${attempt} failed, retrying: ${error.message}`);
            await delay(1000);
        }
    }

    throw lastError;
}

async function runRuntimeCapabilityProof(browser, port, relayUrls) {
    const context = await browser.newContext({serviceWorkers: "block"});
    const page = await context.newPage();
    const pageErrors = watchPage(`spa-runtime:${browserTypeName}`, page);
    const identity = createProofIdentity("runtime");

    try {
        await installProofSigner(page, identity);
        await addSpaInitScript(page, identity, relayUrls);
        await page.goto(`http://127.0.0.1:${port}`, {waitUntil: "domcontentloaded"});
        await waitForInitialSpaState(page, pageErrors);

        const state = await page.evaluate(() => ({
            target: globalThis.__meshdropE2E.config.capabilities.runtime.target,
            hasBackend: globalThis.__meshdropE2E.config.capabilities.runtime.hasBackend,
            localHidden: document.getElementById("local-discovery")?.hasAttribute("hidden"),
            fipsHidden: document.getElementById("fips-discovery")?.hasAttribute("hidden"),
            pollenHidden: document.getElementById("pollen-transfer")?.hasAttribute("hidden"),
            serverSettings: globalThis.__meshdropE2E.config.capabilities.serverSettings.supported
        }));

        assert(state.target === "spa", `Expected SPA runtime, got ${state.target}`);
        assert(state.hasBackend === false, "SPA runtime must not claim a backend");
        assert(state.localHidden === true, "Local discovery control must be hidden");
        assert(state.fipsHidden === true, "FIPS discovery control must be hidden");
        assert(state.pollenHidden === true, "Pollen transfer control must be hidden");
        assert(state.serverSettings === false, "Server settings must be unsupported");
        assert(pageErrors.length === 0, `SPA smoke page errors:\n${pageErrors.join("\n")}`);
    }
    finally {
        await context.close();
    }
}

async function runBackendFreeTransferProof(browser, port, relayUrls, options = {}) {
    if (options.strategyName && options.strategyName !== "default") {
        console.log(`WebKit transfer UAT strategy: ${options.strategyName}`);
    }

    const browserB = options.separateBrowsers ? await launchBrowser(options.browserType) : browser;
    const contextA = await browser.newContext({serviceWorkers: "block"});
    const contextB = options.singleBrowserContext ? contextA : await browserB.newContext({serviceWorkers: "block"});
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const identities = createProofIdentityPair();
    const pageErrors = [
        ...watchPage(`backend-free-spa-nostr-webrtc:${browserTypeName}:a`, pageA),
        ...watchPage(`backend-free-spa-nostr-webrtc:${browserTypeName}:b`, pageB)
    ];

    try {
        if (options.sequentialSetup) {
            await installProofSigner(pageA, identities.a);
            await installProofSigner(pageB, identities.b);
            await addSpaInitScript(pageA, identities.a, relayUrls);
            await addSpaInitScript(pageB, identities.b, relayUrls);
            await pageA.goto(`http://127.0.0.1:${port}`, {waitUntil: "domcontentloaded"});
            await waitForSpaHydration(pageA, "sender");
            await pageB.goto(`http://127.0.0.1:${options.peerBPort || port}`, {waitUntil: "domcontentloaded"});
            await waitForSpaHydration(pageB, "receiver");
            await connectNostr(pageA);
            await connectNostr(pageB);
            await setFollowList(pageA);
            await setFollowList(pageB);
        } else {
            await Promise.all([
                installProofSigner(pageA, identities.a),
                installProofSigner(pageB, identities.b)
            ]);
            await Promise.all([
                addSpaInitScript(pageA, identities.a, relayUrls),
                addSpaInitScript(pageB, identities.b, relayUrls)
            ]);
            await Promise.all([
                pageA.goto(`http://127.0.0.1:${port}`, {waitUntil: "domcontentloaded"}),
                pageB.goto(`http://127.0.0.1:${options.peerBPort || port}`, {waitUntil: "domcontentloaded"})
            ]);
            await Promise.all([waitForSpaHydration(pageA, "sender"), waitForSpaHydration(pageB, "receiver")]);
            await Promise.all([connectNostr(pageA), connectNostr(pageB)]);
            await Promise.all([setFollowList(pageA), setFollowList(pageB)]);
        }
        await Promise.all([
            pageA.evaluate(() => globalThis.meshdropNostrMesh.connect()),
            pageB.evaluate(() => globalThis.meshdropNostrMesh.connect())
        ]);
        await Promise.all([
            pageA.waitForFunction(() => globalThis.meshdropNostrMesh._active),
            pageB.waitForFunction(() => globalThis.meshdropNostrMesh._active)
        ]);

        const peerId = await waitForConnectedPeer(pageA, "nostr");
        await waitForConnectedPeer(pageB, "nostr");
        await sendSpaProofFile(pageA, peerId);
        const received = await waitForReceivedFiles(pageB);

        assert(received[0]?.name.startsWith("meshdrop-spa-proof"), "SPA transfer delivered unexpected file");
        assert(received[0]?.text === proofText, "SPA transfer delivered unexpected contents");
        assert(pageErrors.length === 0, `SPA backend-free transfer page errors:\n${pageErrors.join("\n")}`);
        const proofName = publicRelayUrls.length ? "public-spa-nostr-webrtc" : "backend-free-spa-nostr-webrtc";
        console.log(`Proof ${proofName}:${browserTypeName}: nostr delivered meshdrop-spa-proof.txt`);
    }
    finally {
        await Promise.allSettled(contextA === contextB ? [contextA.close()] : [contextA.close(), contextB.close()]);
        if (browserB !== browser) await browserB.close();
    }
}

async function addSpaInitScript(page, identity, relayUrls) {
    await page.addInitScript(({identity: proofIdentity, relays, payload}) => {
        globalThis.__meshdropDisableNostrRelayNetwork = true;

        localStorage.setItem("meshdrop_relay_settings", JSON.stringify({
            bootstrapRelays: relays,
            webRtcRelays: relays,
            inboxRelays: relays,
            outboxRelays: relays
        }));
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify({
            pubkey: proofIdentity.pubkey,
            displayName: proofIdentity.displayName,
            picture: "",
            relays: {read: relays, write: relays},
            followPubkeys: proofIdentity.followPubkeys,
            followListStatus: "found",
            blossomServers: [],
            blossomServerListStatus: "missing",
            event: {
                kind: 27235,
                created_at: Math.floor(Date.now() / 1000),
                tags: [["client", "meshdrop"], ["origin", location.origin], ["name", proofIdentity.displayName]],
                content: "MeshDrop Nostr identity",
                pubkey: proofIdentity.pubkey,
                id: `${proofIdentity.pubkey.slice(0, 32)}${"0".repeat(32)}`,
                sig: "3".repeat(128)
            }
        }));
        globalThis.nostr = {
            getPublicKey: async () => proofIdentity.pubkey,
            signEvent: async event => globalThis.__meshdropSignEvent(event),
            nip04: {
                encrypt: async (_pubkey, plaintext) => plaintext,
                decrypt: async (_pubkey, ciphertext) => ciphertext
            }
        };

        globalThis.__meshdropE2E = {
            config: null,
            configLoaded: false,
            connected: [],
            followPubkeys: proofIdentity.followPubkeys,
            received: [],
            proofText: payload
        };
        window.addEventListener("config", event => {
            globalThis.__meshdropE2E.config = event.detail;
            globalThis.__meshdropE2E.configLoaded = true;
        });
        window.addEventListener("files-transfer-request", event => {
            window.dispatchEvent(new CustomEvent("respond-to-files-transfer-request", {
                detail: {to: event.detail.peerId, accepted: true}
            }));
        });
        window.addEventListener("files-received", async event => {
            const files = await Promise.all(event.detail.files.map(async file => ({
                name: file.name,
                text: await file.text()
            })));
            globalThis.__meshdropE2E.received.push({peerId: event.detail.peerId, files});
        });
        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropE2E.connected.push(event.detail.peerId);
        });
    }, {
        identity: {
            pubkey: identity.pubkey,
            displayName: identity.displayName,
            followPubkeys: identity.followPubkeys
        },
        relays: relayUrls,
        payload: proofText
    });
}

function watchPage(name, page) {
    const pageErrors = [];
    page.on("crash", () => pageErrors.push(`${name}: page crashed`));
    page.on("close", () => pageErrors.push(`${name}: page closed before smoke completed`));
    page.on("pageerror", error => pageErrors.push(`${name}: ${error.stack || error.message}`));
    page.on("console", message => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (text.includes("RTCErrorEvent")) return;
        pageErrors.push(`${name} console error: ${text}`);
    });
    return pageErrors;
}

async function waitForInitialSpaState(page, pageErrors) {
    try {
        await page.waitForFunction(() => globalThis.__meshdropE2E?.peersManager, undefined, {timeout: spaHydrationTimeoutMs});
        await page.waitForFunction(() => globalThis.__meshdropE2E?.configLoaded, undefined, {timeout: spaHydrationTimeoutMs});
    } catch (error) {
        throw new Error(`${error.message}\n${pageErrors.join("\n")}`, {cause: error});
    }
}

async function waitForSpaHydration(page, role) {
    try {
        await page.waitForFunction(() => (
            globalThis.__meshdropE2E?.configLoaded
            && globalThis.__meshdropE2E?.peersManager
            && globalThis.meshdropNostrIdentity
            && globalThis.meshdropNostrMesh
        ), undefined, {timeout: spaHydrationTimeoutMs});
    } catch (error) {
        throw new Error(`${role} SPA hydration failed: ${error.message}\n${JSON.stringify(await safeDebugPageState(page), null, 2)}`, {
            cause: error
        });
    }
}

async function connectNostr(page) {
    const hasIdentity = await page.evaluate(() => !!globalThis.meshdropNostrIdentity.getIdentity());
    if (hasIdentity) return;

    await page.evaluate(() => globalThis.meshdropNostrIdentity.connect());
    await page.waitForFunction(() => !!globalThis.meshdropNostrIdentity.getIdentity());
}

async function setFollowList(page) {
    await page.evaluate(() => {
        const identity = globalThis.meshdropNostrIdentity.getIdentity();
        identity.followPubkeys = globalThis.__meshdropE2E.followPubkeys;
        identity.followListStatus = "found";
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(identity));
    });
}

async function waitForConnectedPeer(page, roomType) {
    try {
        const handle = await page.waitForFunction(type => {
            const connected = new Set(globalThis.__meshdropE2E.connected || []);
            const peer = [...document.querySelectorAll(`x-peer.type-${type}`)].find(candidate => connected.has(candidate.id));
            return peer?.id || "";
        }, roomType, {timeout: 30000});
        return handle.jsonValue();
    } catch (error) {
        throw new Error(`${error.message}\n${JSON.stringify(await safeDebugPageState(page), null, 2)}`, {cause: error});
    }
}

async function sendSpaProofFile(page, peerId) {
    await page.evaluate(({to, payload}) => {
        const file = new File([payload], "meshdrop-spa-proof.txt", {type: "text/plain"});
        window.dispatchEvent(new CustomEvent("files-selected", {detail: {to, files: [file]}}));
    }, {to: peerId, payload: proofText});
}

async function waitForReceivedFiles(page) {
    try {
        const handle = await page.waitForFunction(() => {
            const batch = globalThis.__meshdropE2E.received.at(-1);
            if (!batch || batch.files.length !== 1) return null;
            return batch.files;
        }, undefined, {timeout: 45000});
        return handle.jsonValue();
    } catch (error) {
        throw new Error(`${error.message}\n${JSON.stringify(await safeDebugPageState(page), null, 2)}`, {cause: error});
    }
}

async function debugPageState(page) {
    return page.evaluate(() => ({
        identity: globalThis.meshdropNostrIdentity?.getIdentity?.(),
        connected: globalThis.__meshdropE2E?.connected,
        received: globalThis.__meshdropE2E?.received,
        nostrMesh: {
            active: globalThis.meshdropNostrMesh?._active,
            connecting: globalThis.meshdropNostrMesh?._connecting,
            room: globalThis.meshdropNostrMesh?._room,
            relayUrls: globalThis.meshdropNostrMesh?._relayUrls,
            relaySockets: globalThis.meshdropNostrMesh?._sockets?.size,
            peers: [...(globalThis.meshdropNostrMesh?._peers || [])]
        },
        peers: [...document.querySelectorAll("x-peer")].map(peer => ({
            id: peer.id,
            classes: [...peer.classList]
        })),
        managerPeers: Object.values(globalThis.__meshdropE2E?.peersManager?.peers || {}).map(peer => ({
            id: peer._peerId,
            isCaller: peer._isCaller,
            roomIds: peer._roomIds,
            channelState: peer._channel?.readyState || "",
            signalingState: peer._conn?.signalingState || "",
            iceConnectionState: peer._conn?.iceConnectionState || "",
            connectionState: peer._conn?.connectionState || "",
            signalSessionId: peer._signalSessionId || ""
        }))
    }));
}

async function safeDebugPageState(page) {
    try {
        return await debugPageState(page);
    } catch (error) {
        return {
            closed: page.isClosed(),
            error: error.message
        };
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
