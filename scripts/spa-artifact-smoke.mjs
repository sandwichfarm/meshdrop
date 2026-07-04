import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {buildSpaArtifact} from "./build-spa-artifact.mjs";
import {startFakeRelay} from "./fake-nostr-relay.mjs";

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browserTypeName = process.env.PLAYWRIGHT_BROWSER || "chromium";
const supportedBrowserTypes = ["chromium", "firefox", "webkit"];
const proofText = "backend-free-spa-nostr-webrtc";
const spaHydrationTimeoutMs = browserTypeName === "webkit" ? 90000 : 30000;

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
    const relay = await startFakeRelay();
    let browser = null;

    try {
        const playwright = await loadPlaywright();
        const browserType = playwright[browserTypeName];
        const launchOptions = {headless: true};
        if (browserTypeName === "chromium" && chromiumPath) launchOptions.executablePath = chromiumPath;
        browser = await browserType.launch(launchOptions);
        const context = await browser.newContext({serviceWorkers: "block"});
        const page = await context.newPage();
        const pageErrors = watchPage(`spa-runtime:${browserTypeName}`, page);
        await addSpaInitScript(page, "runtime", relay.url);

        await page.goto(`http://127.0.0.1:${server.port}`, {waitUntil: "domcontentloaded"});
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
        await context.close();

        await runBackendFreeTransferProof(browser, server.port, relay.url);

        console.log(`SPA artifact smoke passed for ${browserTypeName}: ${result.artifactPath}`);
    }
    finally {
        await browser?.close();
        await new Promise(resolve => relay.close(resolve));
        await new Promise(resolve => server.close(resolve));
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function runBackendFreeTransferProof(browser, port, relayUrl) {
    const contextA = await browser.newContext({serviceWorkers: "block"});
    const contextB = await browser.newContext({serviceWorkers: "block"});
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageErrors = [
        ...watchPage(`backend-free-spa-nostr-webrtc:${browserTypeName}:a`, pageA),
        ...watchPage(`backend-free-spa-nostr-webrtc:${browserTypeName}:b`, pageB)
    ];

    try {
        await Promise.all([
            addSpaInitScript(pageA, "a", relayUrl),
            addSpaInitScript(pageB, "b", relayUrl)
        ]);
        await Promise.all([
            pageA.goto(`http://127.0.0.1:${port}`, {waitUntil: "domcontentloaded"}),
            pageB.goto(`http://127.0.0.1:${port}`, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([waitForSpaHydration(pageA, "sender"), waitForSpaHydration(pageB, "receiver")]);
        await Promise.all([connectNostr(pageA), connectNostr(pageB)]);
        await Promise.all([setFollowList(pageA), setFollowList(pageB)]);
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
        console.log(`Proof backend-free-spa-nostr-webrtc:${browserTypeName}: nostr delivered meshdrop-spa-proof.txt`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function addSpaInitScript(page, identityName, relayUrl) {
    await page.addInitScript(({name, relay, payload}) => {
        globalThis.__meshdropDisableNostrRelayNetwork = true;
        const pubkey = name === "a" ? "1".repeat(64) : "2".repeat(64);
        const displayName = `npub ${pubkey.slice(0, 8)}`;
        let counter = 0;

        localStorage.setItem("meshdrop_relay_settings", JSON.stringify({
            bootstrapRelays: [relay],
            webRtcRelays: [relay],
            inboxRelays: [relay],
            outboxRelays: [relay]
        }));
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify({
            pubkey,
            displayName,
            picture: "",
            relays: {read: [relay], write: [relay]},
            followPubkeys: ["1".repeat(64), "2".repeat(64)],
            followListStatus: "found",
            blossomServers: [],
            blossomServerListStatus: "missing",
            event: {
                kind: 27235,
                created_at: Math.floor(Date.now() / 1000),
                tags: [["client", "meshdrop"], ["origin", location.origin], ["name", displayName]],
                content: "MeshDrop Nostr identity",
                pubkey,
                id: `${pubkey.slice(0, 32)}${"0".repeat(32)}`,
                sig: "3".repeat(128)
            }
        }));
        globalThis.nostr = {
            getPublicKey: async () => pubkey,
            signEvent: async event => ({
                ...event,
                pubkey,
                id: `${pubkey.slice(0, 32)}${String(++counter).padStart(32, "0")}`.slice(0, 64),
                sig: "3".repeat(128)
            }),
            nip04: {
                encrypt: async (_pubkey, plaintext) => plaintext,
                decrypt: async (_pubkey, ciphertext) => ciphertext
            }
        };

        globalThis.__meshdropE2E = {
            config: null,
            configLoaded: false,
            connected: [],
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
    }, {name: identityName, relay: relayUrl, payload: proofText});
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
        await page.waitForFunction(() => globalThis.__meshdropE2E?.peersManager, {timeout: spaHydrationTimeoutMs});
        await page.waitForFunction(() => globalThis.__meshdropE2E?.configLoaded, {timeout: spaHydrationTimeoutMs});
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
        ), {timeout: spaHydrationTimeoutMs});
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
        identity.followPubkeys = ["1".repeat(64), "2".repeat(64)];
        identity.followListStatus = "found";
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(identity));
    });
}

async function waitForConnectedPeer(page, roomType) {
    try {
        const handle = await page.waitForFunction(type => {
            const peer = document.querySelector(`x-peer.type-${type}`);
            if (!peer) return "";
            if (!globalThis.__meshdropE2E.connected.includes(peer.id)) return "";
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
        }, {timeout: 45000});
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

async function loadPlaywright() {
    if (playwrightModulePath) {
        try {
            await fs.access(playwrightModulePath);
            return import(pathToFileURL(playwrightModulePath).href);
        } catch (error) {
            if (process.env.PLAYWRIGHT_MODULE_PATH) {
                throw new Error(`PLAYWRIGHT_MODULE_PATH is not readable: ${playwrightModulePath}\n${error.message}`);
            }
        }
    }

    return import("playwright");
}

function startStaticServer(root) {
    const server = http.createServer(async (request, response) => {
        const urlPath = new URL(request.url, "http://127.0.0.1").pathname;
        const requested = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
        let filePath = path.join(root, requested === "/" ? "index.html" : requested);

        if (path.relative(root, filePath).startsWith("..")) {
            response.writeHead(403).end();
            return;
        }

        try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
            const body = await fs.readFile(filePath);
            response.writeHead(200, {"content-type": contentType(filePath)});
            response.end(body);
        } catch {
            const body = await fs.readFile(path.join(root, "index.html"));
            response.writeHead(200, {"content-type": "text/html; charset=utf-8"});
            response.end(body);
        }
    });

    return new Promise(resolve => {
        server.listen(0, "127.0.0.1", () => {
            resolve({
                close: callback => server.close(callback),
                port: server.address().port
            });
        });
    });
}

function contentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
    if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".mp3")) return "audio/mpeg";
    if (filePath.endsWith(".ogg")) return "audio/ogg";
    return "application/octet-stream";
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}\n${stderr}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
