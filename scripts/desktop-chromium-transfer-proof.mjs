import {
    assert,
    createProofIdentityPair,
    installProofSigner,
    loadPlaywright
} from "./spa-smoke-support.mjs";

export async function runDesktopChromiumTransferProof({
    chromiumExecutablePath = "",
    playwrightModulePath,
    relayUrl,
    url
}) {
    const playwright = await loadPlaywright(playwrightModulePath);
    const browser = await playwright.chromium.launch({
        headless: true,
        ...(chromiumExecutablePath ? {executablePath: chromiumExecutablePath} : {})
    });

    try {
        const contextA = await browser.newContext({serviceWorkers: "block"});
        const contextB = await browser.newContext({serviceWorkers: "block"});

        try {
            await proveTransfer(contextA, contextB, url, relayUrl);
        }
        finally {
            await Promise.allSettled([contextA.close(), contextB.close()]);
        }
    }
    finally {
        await browser.close();
    }
}

async function proveTransfer(contextA, contextB, url, relayUrl) {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const identities = createProofIdentityPair();
    const pageErrors = [
        ...watchPage("desktop-chromium:a", pageA),
        ...watchPage("desktop-chromium:b", pageB)
    ];

    await Promise.all([
        installProofSigner(pageA, identities.a),
        installProofSigner(pageB, identities.b)
    ]);
    await Promise.all([
        addInitScript(pageA, identities.a, [relayUrl]),
        addInitScript(pageB, identities.b, [relayUrl])
    ]);
    await Promise.all([
        pageA.goto(url, {waitUntil: "domcontentloaded"}),
        pageB.goto(url, {waitUntil: "domcontentloaded"})
    ]);
    await Promise.all([
        waitForHydration(pageA, "desktop chromium sender"),
        waitForHydration(pageB, "desktop chromium receiver")
    ]);

    await assertDesktopRuntime(pageA);
    await Promise.all([connectNostr(pageA), connectNostr(pageB)]);
    await Promise.all([restoreFollowList(pageA), restoreFollowList(pageB)]);
    await Promise.all([
        pageA.evaluate(() => globalThis.meshdropNostrMesh.connect()),
        pageB.evaluate(() => globalThis.meshdropNostrMesh.connect())
    ]);

    const peerId = await waitForConnectedPeer(pageA, "nostr");
    await waitForConnectedPeer(pageB, "nostr");
    await sendProofFile(pageA, peerId);
    const received = await waitForReceivedFiles(pageB);

    assert(received[0]?.name === "meshdrop-desktop-chromium-proof.txt", "Desktop Chromium shell delivered wrong file");
    assert(received[0]?.text === "desktop-chromium-shell", "Desktop Chromium shell delivered wrong contents");
    assert(pageErrors.length === 0, `Desktop Chromium shell page errors:\n${pageErrors.join("\n")}`);
}

async function assertDesktopRuntime(page) {
    const runtime = await page.evaluate(() => ({
        target: globalThis.__meshdropE2E.config.capabilities.runtime.target,
        platform: globalThis.__meshdropE2E.config.capabilities.runtime.platform,
        webrtc: globalThis.__meshdropE2E.config.capabilities.transports.webrtc.supported,
        nostr: globalThis.__meshdropE2E.config.capabilities.transports.nostr.supported,
        rtc: typeof RTCPeerConnection
    }));
    assert(runtime.target === "desktop", `Expected desktop runtime, got ${runtime.target}`);
    assert(runtime.platform === "desktop", `Expected desktop platform, got ${runtime.platform}`);
    assert(runtime.webrtc === true, "Desktop Chromium shell must report WebRTC support");
    assert(runtime.nostr === true, "Desktop Chromium shell must report Nostr support");
    assert(runtime.rtc === "function", "Chromium shell did not expose RTCPeerConnection");
}

async function addInitScript(page, identity, relayUrls) {
    await page.addInitScript(({proofIdentity, relays}) => {
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
            blossomServerListStatus: "missing"
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
            received: []
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
        proofIdentity: {
            pubkey: identity.pubkey,
            displayName: identity.displayName,
            followPubkeys: identity.followPubkeys
        },
        relays: relayUrls
    });
}

function watchPage(name, page) {
    const pageErrors = [];
    page.on("crash", () => pageErrors.push(`${name}: page crashed`));
    page.on("close", () => pageErrors.push(`${name}: page closed before smoke completed`));
    page.on("pageerror", error => pageErrors.push(`${name}: ${error.stack || error.message}`));
    page.on("console", message => {
        if (message.type() === "error") pageErrors.push(`${name} console error: ${message.text()}`);
    });
    return pageErrors;
}

async function waitForHydration(page, role) {
    try {
        await page.waitForFunction(() => (
            globalThis.__meshdropE2E?.configLoaded
            && globalThis.meshdropNostrIdentity
            && globalThis.meshdropNostrMesh
        ), undefined, {timeout: 30000});
    } catch (error) {
        throw new Error(`${role} hydration failed: ${error.message}`, {cause: error});
    }
}

async function connectNostr(page) {
    const hasIdentity = await page.evaluate(() => !!globalThis.meshdropNostrIdentity.getIdentity());
    if (!hasIdentity) await page.evaluate(() => globalThis.meshdropNostrIdentity.connect());
    await page.waitForFunction(() => !!globalThis.meshdropNostrIdentity.getIdentity());
}

async function restoreFollowList(page) {
    await page.evaluate(() => {
        const identity = globalThis.meshdropNostrIdentity.getIdentity();
        identity.followPubkeys = globalThis.__meshdropE2E.followPubkeys;
        identity.followListStatus = "found";
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(identity));
    });
}

async function waitForConnectedPeer(page, roomType) {
    const handle = await page.waitForFunction(type => {
        const peer = document.querySelector(`x-peer.type-${type}`);
        if (!peer) return "";
        if (!globalThis.__meshdropE2E.connected.includes(peer.id)) return "";
        return peer.id;
    }, roomType, {timeout: 30000});
    return handle.jsonValue();
}

async function sendProofFile(page, peerId) {
    await page.evaluate(to => {
        const file = new File(["desktop-chromium-shell"], "meshdrop-desktop-chromium-proof.txt", {
            type: "text/plain"
        });
        window.dispatchEvent(new CustomEvent("files-selected", {detail: {to, files: [file]}}));
    }, peerId);
}

async function waitForReceivedFiles(page) {
    const handle = await page.waitForFunction(() => {
        const batch = globalThis.__meshdropE2E.received.at(-1);
        if (!batch || batch.files.length !== 1) return null;
        return batch.files;
    }, undefined, {timeout: 45000});
    return handle.jsonValue();
}
