import fs from "node:fs/promises";
import {pathToFileURL} from "node:url";

const baseUrl = process.env.MESHDROP_DOCKER_TRANSFER_BASE_URL || process.argv[2];
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const proofIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#1b806a"/>
  <path d="M18 34 28 44 47 21" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
    if (!baseUrl) throw new Error("MESHDROP_DOCKER_TRANSFER_BASE_URL or base URL argument is required");

    await waitForHttp(`${baseUrl}/config`);
    const {chromium} = await loadPlaywright();
    const browser = await chromium.launch(await launchOptions());

    try {
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
        await sendProofIcon(pageA, peerId, options.transportId);

        const received = await waitForReceivedFiles(pageB);
        assertReceived(received);
        assert(!logs.pageErrors.length, `${options.name}: page errors: ${logs.pageErrors.join("\n")}`);
        console.log(`Proof ${options.name}: ${options.transportId} delivered meshdrop-proof-icon.svg`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function newContext(browser) {
    const context = await browser.newContext({serviceWorkers: "block"});
    await context.addInitScript(() => {
        globalThis.__meshdropDisableNostrRelayNetwork = true;
        globalThis.__meshdropDockerTransfer = {connected: [], received: [], configLoaded: false, wsConnected: false};

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
    });

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

async function waitForConnectedPeer(page, roomType) {
    const peerId = await page.waitForFunction(type => {
        const peer = document.querySelector(`x-peer.type-${type}`);
        if (!peer) return "";
        if (!globalThis.__meshdropDockerTransfer.connected.includes(peer.id)) return "";
        return peer.id;
    }, roomType, {timeout: 20000});

    return peerId.jsonValue();
}

async function sendProofIcon(page, peerId, transportId) {
    await page.evaluate(({to, icon, transport}) => {
        const file = new File([icon], "meshdrop-proof-icon.svg", {type: "image/svg+xml"});
        window.dispatchEvent(new CustomEvent("select-files-transport", {detail: {to, files: [file]}}));
        const button = document.querySelector(`[data-transport-id="${transport}"]`);
        if (!button) throw new Error(`Missing transport option ${transport}`);
        button.click();
    }, {to: peerId, icon: proofIcon, transport: transportId});
}

async function waitForReceivedFiles(page) {
    const handle = await page.waitForFunction(() => {
        const batch = globalThis.__meshdropDockerTransfer.received.at(-1);
        if (!batch || batch.files.length !== 1) return null;
        return batch.files;
    }, {timeout: 45000});

    return handle.jsonValue();
}

function assertReceived(received) {
    const file = received[0];
    assert(file.name.startsWith("meshdrop-proof-icon"), `received unexpected file ${file.name}`);
    assert(file.text === proofIcon, "received proof file contents did not match");
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
