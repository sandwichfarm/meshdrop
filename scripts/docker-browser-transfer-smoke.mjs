import fs from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {finalizeEvent, generateSecretKey, getPublicKey} from "nostr-tools";

const baseUrl = process.env.MESHDROP_DOCKER_TRANSFER_BASE_URL || process.argv[2];
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const adminSecretKey = secretKeyFromHex(process.env.MESHDROP_DOCKER_ADMIN_SECRET_KEY || "");
const adminFipsPeerNpub = process.env.MESHDROP_DOCKER_ADMIN_FIPS_PEER_NPUB || "npub1peer";

async function main() {
    if (!baseUrl) throw new Error("MESHDROP_DOCKER_TRANSFER_BASE_URL or base URL argument is required");

    await waitForHttp(`${baseUrl}/config`);
    const {chromium} = await loadPlaywright();
    const browser = await chromium.launch(await launchOptions());

    try {
        if (adminSecretKey) await runAdminSettingsProof(browser, adminSecretKey);
        await runProofTransfer(browser, {
            name: "docker-local-webrtc",
            roomType: "ip",
            transportId: "local"
        });
        await runProofTransfer(browser, {
            name: "docker-pollen-webrtc",
            roomType: "pollen",
            transportId: "pollen-mesh",
            setupBoth: async pages => {
                await Promise.all(pages.map(page => page.evaluate(() => globalThis.meshdropPollenTransfer.enable())));
                await Promise.all(pages.map(page => (
                    page.waitForFunction(() => globalThis.meshdropPollenTransfer.isActive())
                )));
            }
        });
    }
    finally {
        await browser.close();
    }

    console.log(`Docker browser transfer smoke passed against ${baseUrl}`);
}

async function runAdminSettingsProof(browser, secretKey) {
    const adminContext = await newContext(browser, {signerSecretKey: secretKey});
    const nonAdminContext = await newContext(browser, {signerSecretKey: generateSecretKey()});
    const adminPage = await adminContext.newPage();
    const nonAdminPage = await nonAdminContext.newPage();
    const logs = watchPages("docker-admin-settings", [adminPage, nonAdminPage]);

    try {
        await Promise.all([
            adminPage.goto(baseUrl, {waitUntil: "domcontentloaded"}),
            nonAdminPage.goto(baseUrl, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([waitForHydration(adminPage), waitForHydration(nonAdminPage)]);

        await connectNostrIdentity(nonAdminPage);
        await assertFipsSettingsHidden(nonAdminPage);
        const nonAdminError = await nonAdminPage.evaluate(async () => {
            try {
                await fetch("/settings/fips/peers", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({peers: []})
                });
                return "";
            } catch (error) {
                return error.message;
            }
        });
        assert(
            nonAdminError.includes("configured admin npub is not connected"),
            `non-admin settings request was not rejected by the GUI signer gate: ${nonAdminError}`
        );

        await connectNostrIdentity(adminPage);
        await adminPage.waitForFunction(() => globalThis.AdminSettingsProtocol.canManageCurrentServerSettings());
        await adminPage.waitForFunction(() => !document.querySelector('[data-settings-tab="fips"]')?.hasAttribute("hidden"));
        await adminPage.click("#protocol-settings");
        await adminPage.click('[data-settings-tab="fips"]');
        await adminPage.click(".fips-add-peer");
        await adminPage.fill('.fips-peer-row [data-field="npub"]', adminFipsPeerNpub);
        await adminPage.fill('.fips-peer-row [data-field="address"]', "203.0.113.9:2121");
        await adminPage.selectOption('.fips-peer-row [data-field="transport"]', "tcp");
        await adminPage.click(".fips-save-peers");
        await adminPage.waitForFunction(() => (
            document.querySelector(".fips-settings-status")?.textContent.includes("Saved FIPS peers")
        ));

        assert(!logs.pageErrors.length, `docker-admin-settings: page errors: ${logs.pageErrors.join("\n")}`);
        console.log("Proof docker-admin-settings: signed admin GUI saved FIPS peers");
    }
    finally {
        await Promise.allSettled([adminContext.close(), nonAdminContext.close()]);
    }
}

async function runProofTransfer(browser, options) {
    const contextA = await newContext(browser);
    const contextB = await newContext(browser);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const logs = watchPages(options.name, [pageA, pageB]);

    try {
        await Promise.all([
            pageA.goto(baseUrl, {waitUntil: "domcontentloaded"}),
            pageB.goto(baseUrl, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([waitForHydration(pageA), waitForHydration(pageB)]);

        if (options.setupBoth) await options.setupBoth([pageA, pageB]);

        const peerId = await waitForConnectedPeer(pageA, options.roomType);
        await waitForConnectedPeer(pageB, options.roomType);
        const proofFile = createProofFile(options);
        await sendProofFile(pageA, peerId, options.transportId, proofFile);

        const received = await waitForReceivedFiles(pageB, options.name);
        assertReceived(received, proofFile);
        assert(!logs.pageErrors.length, `${options.name}: page errors: ${logs.pageErrors.join("\n")}`);
        console.log(`Proof ${options.name}: ${options.transportId} delivered ${proofFile.name}`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function newContext(browser, options = {}) {
    const context = await browser.newContext({serviceWorkers: "block"});
    if (options.signerSecretKey) {
        const pubkey = getPublicKey(options.signerSecretKey);
        await context.exposeFunction("__meshdropDockerGetPublicKey", () => pubkey);
        await context.exposeFunction("__meshdropDockerSignEvent", event => (
            finalizeEvent(event, options.signerSecretKey)
        ));
    }

    await context.addInitScript(({hasSigner}) => {
        globalThis.__meshdropDisableNostrRelayNetwork = true;
        globalThis.__meshdropDockerTransfer = {connected: [], received: [], configLoaded: false, wsConnected: false};
        if (hasSigner) {
            window.nostr = {
                getPublicKey: () => window.__meshdropDockerGetPublicKey(),
                signEvent: event => window.__meshdropDockerSignEvent(event)
            };
        }

        window.addEventListener("config", () => globalThis.__meshdropDockerTransfer.configLoaded = true);
        window.addEventListener("ws-connected", () => globalThis.__meshdropDockerTransfer.wsConnected = true);
        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropDockerTransfer.connected.push(event.detail.peerId);
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
            globalThis.__meshdropDockerTransfer.received.push({peerId: event.detail.peerId, files});
        });
    }, {hasSigner: !!options.signerSecretKey});

    return context;
}

function watchPages(name, pages) {
    const pageErrors = [];
    pages.forEach((page, index) => {
        const label = `${name}:${index === 0 ? "sender" : "receiver"}`;
        page.on("pageerror", error => pageErrors.push(`${label}: ${error.stack || error.message}`));
        page.on("console", message => {
            if (message.type() !== "error") return;
            const text = message.text();
            if (text.includes("RTCErrorEvent")) return;
            pageErrors.push(`${label} console error: ${text}`);
        });
    });

    return {pageErrors};
}

async function waitForHydration(page) {
    await page.waitForFunction(() => (
        globalThis.meshdropLocalDiscovery
        && globalThis.meshdropPollenTransfer
        && globalThis.__meshdropDockerTransfer.configLoaded
        && globalThis.__meshdropDockerTransfer.wsConnected
        && document.querySelector("x-peers")
    ));
}

async function connectNostrIdentity(page) {
    await page.evaluate(() => globalThis.meshdropNostrIdentity.connect());
    await page.waitForFunction(() => !!globalThis.meshdropNostrIdentity.getIdentity());
}

async function assertFipsSettingsHidden(page) {
    const hidden = await page.waitForFunction(() => (
        document.querySelector('[data-settings-tab="fips"]')?.hasAttribute("hidden")
    ));
    assert(await hidden.jsonValue(), "non-admin FIPS settings tab was visible");
}

async function waitForConnectedPeer(page, roomType) {
    const peerId = await page.waitForFunction(type => {
        const peer = document.querySelector(`x-peer.type-${type}`);
        if (!peer) return "";
        if (!globalThis.__meshdropDockerTransfer.connected.includes(peer.id)) return "";
        return peer.id;
    }, roomType, {timeout: 20000});

    return peerId.jsonValue();
}

function createProofFile(options) {
    return {
        name: `meshdrop-${options.name}-proof.txt`,
        text: [
            "MeshDrop Docker browser transfer proof",
            `scenario=${options.name}`,
            `transport=${options.transportId}`,
            `roomType=${options.roomType}`
        ].join("\n")
    };
}

async function sendProofFile(page, peerId, transportId, proofFile) {
    await page.evaluate(({to, proof, transport}) => {
        const file = new File([proof.text], proof.name, {type: "text/plain"});
        window.dispatchEvent(new CustomEvent("select-files-transport", {detail: {to, files: [file]}}));
        const button = document.querySelector(`[data-transport-id="${transport}"]`);
        if (!button) throw new Error(`Missing transport option ${transport}`);
        button.click();
    }, {to: peerId, proof: proofFile, transport: transportId});
}

async function waitForReceivedFiles(page, name) {
    let handle;
    try {
        handle = await page.waitForFunction(() => {
            const batch = globalThis.__meshdropDockerTransfer.received.at(-1);
            if (!batch || batch.files.length !== 1) return null;
            return batch.files;
        }, undefined, {timeout: 45000});
    } catch (error) {
        throw new Error(`${name}: ${error.message}\nstate=${JSON.stringify(await debugPageState(page))}`);
    }

    return handle.jsonValue();
}

async function debugPageState(page) {
    return page.evaluate(() => ({
        connected: globalThis.__meshdropDockerTransfer?.connected,
        received: globalThis.__meshdropDockerTransfer?.received,
        peers: [...document.querySelectorAll("x-peer")].map(peer => ({
            id: peer.id,
            classes: [...peer.classList]
        })),
        managerPeers: Object.values(globalThis.__meshdropE2E?.peersManager?.peers || {}).map(peer => ({
            id: peer._peerId,
            roomIds: peer._roomIds,
            channelState: peer._channel?.readyState || "",
            connectionState: peer._conn?.connectionState || ""
        }))
    }));
}

function assertReceived(received, proofFile) {
    const file = received[0];
    assert(file.name === proofFile.name, `received unexpected file ${file.name}`);
    assert(file.text === proofFile.text, "received proof file contents did not match");
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

async function launchOptions() {
    const options = {headless: true};
    const executablePath = await resolveChromiumPath();
    if (executablePath) options.executablePath = executablePath;
    return options;
}

async function resolveChromiumPath() {
    if (chromiumPath !== undefined) return chromiumPath;

    try {
        await fs.access("/usr/bin/chromium");
        return "/usr/bin/chromium";
    } catch {
        return "";
    }
}

async function waitForHttp(url) {
    for (let i = 0; i < 60; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            await delay(500);
        }
    }

    throw new Error(`Timed out waiting for ${url}`);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function secretKeyFromHex(value) {
    if (!value) return null;
    if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("MESHDROP_DOCKER_ADMIN_SECRET_KEY must be 32-byte hex");
    const bytes = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
