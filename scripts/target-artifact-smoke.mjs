import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildDesktopPackage} from "./build-desktop-package.mjs";
import {buildMobilePackage} from "./build-mobile-package.mjs";
import {startFakeRelay} from "./fake-nostr-relay.mjs";
import {
    assert,
    createProofIdentityPair,
    installProofSigner,
    loadPlaywright,
    run,
    startStaticServer
} from "./spa-smoke-support.mjs";

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const hydrationTimeoutMs = 30000;
const transferTimeoutMs = 45000;
const targets = [
    {
        name: "desktop",
        platform: "desktop",
        build: options => buildDesktopPackage(options)
    },
    {
        name: "ios",
        platform: "mobile",
        build: options => buildMobilePackage({...options, target: "ios"}),
        context: {
            isMobile: true,
            viewport: {width: 390, height: 844},
            userAgent: "MeshDropTargetSmoke/ios Mobile"
        }
    },
    {
        name: "android",
        platform: "mobile",
        build: options => buildMobilePackage({...options, target: "android"}),
        context: {
            isMobile: true,
            viewport: {width: 412, height: 915},
            userAgent: "MeshDropTargetSmoke/android Mobile"
        }
    }
];

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-target-artifacts-"));
    const relay = await startFakeRelay();

    try {
        const playwright = await loadPlaywright(playwrightModulePath);
        const browser = await playwright.chromium.launch({
            headless: true,
            ...(chromiumExecutablePath ? {executablePath: chromiumExecutablePath} : {})
        });

        try {
            for (const target of targets) {
                await smokeTargetArtifact(browser, target, tempDir, relay.url);
            }
        }
        finally {
            await browser.close();
        }
    }
    finally {
        await new Promise(resolve => relay.close(resolve));
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function smokeTargetArtifact(browser, target, tempDir, relayUrl) {
    const buildDir = path.join(tempDir, target.name);
    const result = await target.build({
        version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-smoke",
        outDir: buildDir,
        env: {
            ...process.env,
            MESH_DROP_BUILD_ID: `${target.name}-transfer-smoke`
        }
    });
    const unpackDir = path.join(buildDir, "unpacked");
    await fs.mkdir(unpackDir, {recursive: true});
    await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

    const root = path.join(unpackDir, result.prefix);
    const server = await startStaticServer(root);

    try {
        await runRuntimeProof(browser, target, server.port, relayUrl);
        await runTransferProof(browser, target, server.port, relayUrl);
        console.log(`Target artifact smoke passed for ${target.name}: ${result.artifactPath}`);
    }
    finally {
        await new Promise(resolve => server.close(resolve));
    }
}

async function runRuntimeProof(browser, target, port, relayUrl) {
    const context = await browser.newContext({serviceWorkers: "block", ...target.context});
    const page = await context.newPage();
    const pageErrors = watchPage(`${target.name}-runtime`, page);
    const identities = createProofIdentityPair();

    try {
        await installProofSigner(page, identities.a);
        await addTargetInitScript(page, identities.a, [relayUrl], target.name);
        await page.goto(`http://127.0.0.1:${port}/app/`, {waitUntil: "domcontentloaded"});
        await waitForHydration(page, target.name);

        const state = await page.evaluate(() => ({
            target: globalThis.__meshdropE2E.config.capabilities.runtime.target,
            platform: globalThis.__meshdropE2E.config.capabilities.runtime.platform,
            hasBackend: globalThis.__meshdropE2E.config.capabilities.runtime.hasBackend,
            instanceHidden: document.getElementById("local-discovery")?.hasAttribute("hidden"),
            clearnetHidden: document.getElementById("clearnet-routes")?.hasAttribute("hidden"),
            clearnetTitle: document.getElementById("clearnet-routes")?.title,
            fipsHidden: document.getElementById("fips-discovery")?.hasAttribute("hidden"),
            pollenHidden: document.getElementById("pollen-transfer")?.hasAttribute("hidden"),
            serverSettings: globalThis.__meshdropE2E.config.capabilities.serverSettings.supported
        }));

        assert(state.target === target.name, `Expected ${target.name} runtime, got ${state.target}`);
        assert(state.platform === target.platform, `Expected ${target.platform} platform, got ${state.platform}`);
        assert(state.hasBackend === false, `${target.name} source artifact must not claim a backend`);
        assert(state.instanceHidden === true, "Instance control must hide without same-instance backend support");
        assert(state.clearnetHidden === false, "Clearnet route control must stay visible for direct Nostr WebRTC");
        assert(
            state.clearnetTitle?.startsWith("Clearnet WebRTC routes enabled"),
            `Clearnet route control title was ${state.clearnetTitle}`
        );
        assert(state.fipsHidden === true, "FIPS discovery control must be hidden");
        assert(state.pollenHidden === true, "Pollen transfer control must be hidden");
        assert(state.serverSettings === false, "Server settings must be unsupported");
        assert(pageErrors.length === 0, `${target.name} runtime page errors:\n${pageErrors.join("\n")}`);
    }
    finally {
        await context.close();
    }
}

async function runTransferProof(browser, target, port, relayUrl) {
    const contextA = await browser.newContext({serviceWorkers: "block", ...target.context});
    const contextB = await browser.newContext({serviceWorkers: "block", ...target.context});
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const identities = createProofIdentityPair();
    const pageErrors = [
        ...watchPage(`${target.name}-nostr-webrtc:a`, pageA),
        ...watchPage(`${target.name}-nostr-webrtc:b`, pageB)
    ];

    try {
        await Promise.all([
            installProofSigner(pageA, identities.a),
            installProofSigner(pageB, identities.b)
        ]);
        await Promise.all([
            addTargetInitScript(pageA, identities.a, [relayUrl], target.name),
            addTargetInitScript(pageB, identities.b, [relayUrl], target.name)
        ]);
        await Promise.all([
            pageA.goto(`http://127.0.0.1:${port}/app/`, {waitUntil: "domcontentloaded"}),
            pageB.goto(`http://127.0.0.1:${port}/app/`, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([
            waitForHydration(pageA, `${target.name} sender`),
            waitForHydration(pageB, `${target.name} receiver`)
        ]);
        await Promise.all([connectNostr(pageA), connectNostr(pageB)]);
        await Promise.all([restoreFollowList(pageA), restoreFollowList(pageB)]);
        await Promise.all([
            pageA.evaluate(() => globalThis.meshdropNostrMesh.connect()),
            pageB.evaluate(() => globalThis.meshdropNostrMesh.connect())
        ]);

        const peerId = await waitForConnectedPeer(pageA, "nostr");
        await waitForConnectedPeer(pageB, "nostr");
        await sendProofFile(pageA, target.name, peerId);
        const received = await waitForReceivedFiles(pageB);

        assert(received[0]?.name === `meshdrop-${target.name}-proof.txt`, `${target.name} delivered unexpected file`);
        assert(received[0]?.text === `target-artifact-${target.name}`, `${target.name} delivered unexpected contents`);
        assert(pageErrors.length === 0, `${target.name} transfer page errors:\n${pageErrors.join("\n")}`);
        console.log(`Proof ${target.name}-artifact-nostr-webrtc: nostr delivered meshdrop-${target.name}-proof.txt`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function addTargetInitScript(page, identity, relayUrls, targetName) {
    await page.addInitScript(({proofIdentity, relays, name}) => {
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
                tags: [["client", "meshdrop"], ["target", name], ["origin", location.origin]],
                content: "MeshDrop target artifact identity",
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
        relays: relayUrls,
        name: targetName
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

async function waitForHydration(page, role) {
    try {
        await page.waitForFunction(() => (
            globalThis.__meshdropE2E?.configLoaded
            && globalThis.__meshdropE2E?.peersManager
            && globalThis.meshdropNostrIdentity
            && globalThis.meshdropNostrMesh
        ), undefined, {timeout: hydrationTimeoutMs});
    } catch (error) {
        throw new Error(`${role} hydration failed: ${error.message}\n${JSON.stringify(await debugPageState(page), null, 2)}`, {
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

async function restoreFollowList(page) {
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
        throw new Error(`${error.message}\n${JSON.stringify(await debugPageState(page), null, 2)}`, {cause: error});
    }
}

async function sendProofFile(page, targetName, peerId) {
    await page.evaluate(({name, to}) => {
        const file = new File([`target-artifact-${name}`], `meshdrop-${name}-proof.txt`, {type: "text/plain"});
        window.dispatchEvent(new CustomEvent("files-selected", {detail: {to, files: [file]}}));
    }, {name: targetName, to: peerId});
}

async function waitForReceivedFiles(page) {
    try {
        const handle = await page.waitForFunction(() => {
            const batch = globalThis.__meshdropE2E.received.at(-1);
            if (!batch || batch.files.length !== 1) return null;
            return batch.files;
        }, undefined, {timeout: transferTimeoutMs});
        return handle.jsonValue();
    } catch (error) {
        throw new Error(`${error.message}\n${JSON.stringify(await debugPageState(page), null, 2)}`, {cause: error});
    }
}

async function debugPageState(page) {
    try {
        return await page.evaluate(() => ({
            config: globalThis.__meshdropE2E?.config?.capabilities?.runtime,
            connected: globalThis.__meshdropE2E?.connected,
            received: globalThis.__meshdropE2E?.received,
            nostrMesh: {
                active: globalThis.meshdropNostrMesh?._active,
                connecting: globalThis.meshdropNostrMesh?._connecting,
                room: globalThis.meshdropNostrMesh?._room,
                relaySockets: globalThis.meshdropNostrMesh?._sockets?.size,
                peers: [...(globalThis.meshdropNostrMesh?._peers || [])]
            },
            peers: [...document.querySelectorAll("x-peer")].map(peer => ({
                id: peer.id,
                classes: [...peer.classList]
            })),
            managerPeers: Object.values(globalThis.__meshdropE2E?.peersManager?.peers || {}).map(peer => ({
                id: peer._peerId,
                roomIds: peer._roomIds,
                channelState: peer._channel?.readyState || "",
                signalingState: peer._conn?.signalingState || "",
                connectionState: peer._conn?.connectionState || ""
            }))
        }));
    } catch (error) {
        return {closed: page.isClosed(), error: error.message};
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
