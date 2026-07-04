import {spawn} from "node:child_process";

import {startFakeRelay} from "./fake-nostr-relay.mjs";
import {
    assert,
    createProofIdentityPair,
    delay,
    installProofSigner,
    loadPlaywright,
    parseRelayUrls
} from "./spa-smoke-support.mjs";

const image = process.env.MESHDROP_DOCKER_IMAGE || "meshdrop:smoke";
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const publicRelayUrls = parseRelayUrls(process.env.MESHDROP_DOCKER_PUBLIC_RELAY_URLS || "");
const containers = [
    `meshdrop-two-host-a-${process.pid}`,
    `meshdrop-two-host-b-${process.pid}`
];
const proofIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#284d8f"/>
  <path d="M18 34 28 44 47 21" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
    if (process.env.MESHDROP_DOCKER_SKIP_BUILD !== "1") await run("docker", ["build", "-t", image, "."]);

    const relay = publicRelayUrls.length ? null : await startFakeRelay();
    const relayUrls = publicRelayUrls.length ? publicRelayUrls : [relay.url];

    let started = false;
    try {
        await Promise.all(containers.map(name => startContainer(name, relayUrls)));
        started = true;

        const baseUrls = await Promise.all(containers.map(async name => {
            const port = await mappedPort(name);
            const baseUrl = `http://127.0.0.1:${port}`;
            await waitForHttp(`${baseUrl}/config`);
            await waitForHealth(name);
            return baseUrl;
        }));

        await runTwoHostTransfer(baseUrls, relayUrls);
        console.log(`Docker two-host relay smoke passed for ${image}: ${baseUrls.join(" <-> ")}`);
    }
    finally {
        if (started) {
            await Promise.allSettled(containers.map(name => run("docker", ["rm", "-f", name], {allowFailure: true})));
        }
        if (relay) await new Promise(resolve => relay.close(resolve));
    }
}

async function startContainer(name, relayUrls) {
    await run("docker", [
        "run",
        "-d",
        "--name",
        name,
        "-p",
        "127.0.0.1::3000",
        "-e",
        `NOSTR_RELAYS=${relayUrls.join(",")}`,
        image
    ]);
}

async function runTwoHostTransfer([baseUrlA, baseUrlB], relayUrls) {
    const {chromium} = await loadPlaywright(playwrightModulePath);
    const browser = await chromium.launch(await launchOptions());
    const identities = createProofIdentityPair();
    const contextA = await browser.newContext({serviceWorkers: "block"});
    const contextB = await browser.newContext({serviceWorkers: "block"});
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageErrors = [
        ...watchPage("docker-two-host-nostr-webrtc:sender", pageA),
        ...watchPage("docker-two-host-nostr-webrtc:receiver", pageB)
    ];

    try {
        await Promise.all([
            installProofSigner(pageA, identities.a),
            installProofSigner(pageB, identities.b)
        ]);
        await Promise.all([
            addNostrInitScript(pageA, identities.a, relayUrls),
            addNostrInitScript(pageB, identities.b, relayUrls)
        ]);
        await Promise.all([
            pageA.goto(baseUrlA, {waitUntil: "domcontentloaded"}),
            pageB.goto(baseUrlB, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([waitForHydration(pageA, "sender"), waitForHydration(pageB, "receiver")]);
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
        await sendProofIcon(pageA, peerId);
        const received = await waitForReceivedFiles(pageB);

        assertReceived(received);
        assert(!pageErrors.length, `Docker two-host relay page errors:\n${pageErrors.join("\n")}`);
        const proofName = publicRelayUrls.length ? "docker-public-relay-two-host-webrtc" : "docker-two-host-nostr-webrtc";
        console.log(`Proof ${proofName}: nostr delivered meshdrop-proof-icon.svg between two Docker instances`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close(), browser.close()]);
    }
}

async function addNostrInitScript(page, identity, relayUrls) {
    await page.addInitScript(({proofIdentity, relays}) => {
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
                content: "MeshDrop Docker relay identity",
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

        globalThis.__meshdropDockerTwoHost = {
            configLoaded: false,
            connected: [],
            followPubkeys: proofIdentity.followPubkeys,
            received: []
        };
        globalThis.__meshdropE2E = {peersManager: null};
        window.addEventListener("config", () => globalThis.__meshdropDockerTwoHost.configLoaded = true);
        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropDockerTwoHost.connected.push(event.detail.peerId);
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
            globalThis.__meshdropDockerTwoHost.received.push({peerId: event.detail.peerId, files});
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

async function waitForHydration(page, role) {
    try {
        await page.waitForFunction(() => (
            globalThis.__meshdropDockerTwoHost?.configLoaded
            && globalThis.__meshdropE2E?.peersManager
            && globalThis.meshdropNostrIdentity
            && globalThis.meshdropNostrMesh
        ), undefined, {timeout: 30000});
    } catch (error) {
        throw new Error(`${role} Docker page hydration failed: ${error.message}\n${JSON.stringify(await debugPageState(page))}`, {
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
        identity.followPubkeys = globalThis.__meshdropDockerTwoHost.followPubkeys;
        identity.followListStatus = "found";
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(identity));
    });
}

async function waitForConnectedPeer(page, roomType) {
    try {
        const handle = await page.waitForFunction(type => {
            const peer = document.querySelector(`x-peer.type-${type}`);
            if (!peer) return "";
            if (!globalThis.__meshdropDockerTwoHost.connected.includes(peer.id)) return "";
            return peer.id;
        }, roomType, {timeout: 30000});
        return handle.jsonValue();
    } catch (error) {
        throw new Error(`${error.message}\n${JSON.stringify(await debugPageState(page))}`, {cause: error});
    }
}

async function sendProofIcon(page, peerId) {
    await page.evaluate(({to, icon}) => {
        const file = new File([icon], "meshdrop-proof-icon.svg", {type: "image/svg+xml"});
        window.dispatchEvent(new CustomEvent("select-files-transport", {detail: {to, files: [file]}}));
        const button = document.querySelector('[data-transport-id="webrtc"]');
        if (!button) throw new Error("Missing Nostr relay transport option");
        button.click();
    }, {to: peerId, icon: proofIcon});
}

async function waitForReceivedFiles(page) {
    try {
        const handle = await page.waitForFunction(() => {
            const batch = globalThis.__meshdropDockerTwoHost.received.at(-1);
            if (!batch || batch.files.length !== 1) return null;
            return batch.files;
        }, undefined, {timeout: 45000});
        return handle.jsonValue();
    } catch (error) {
        throw new Error(`${error.message}\n${JSON.stringify(await debugPageState(page))}`, {cause: error});
    }
}

function assertReceived(received) {
    const file = received[0];
    assert(file.name.startsWith("meshdrop-proof-icon"), `received unexpected file ${file.name}`);
    assert(file.text === proofIcon, "received proof file contents did not match");
}

function watchPage(name, page) {
    const pageErrors = [];
    page.on("crash", () => pageErrors.push(`${name}: page crashed`));
    page.on("pageerror", error => pageErrors.push(`${name}: ${error.stack || error.message}`));
    page.on("console", message => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (text.includes("RTCErrorEvent")) return;
        pageErrors.push(`${name} console error: ${text}`);
    });
    return pageErrors;
}

async function debugPageState(page) {
    return page.evaluate(() => ({
        connected: globalThis.__meshdropDockerTwoHost?.connected,
        received: globalThis.__meshdropDockerTwoHost?.received,
        nostrMesh: {
            active: globalThis.meshdropNostrMesh?._active,
            connecting: globalThis.meshdropNostrMesh?._connecting,
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
            roomIds: peer._roomIds,
            channelState: peer._channel?.readyState || "",
            connectionState: peer._conn?.connectionState || "",
            signalSessionId: peer._signalSessionId || ""
        }))
    }));
}

async function mappedPort(container) {
    for (let i = 0; i < 30; i++) {
        const output = await run("docker", ["port", container, "3000/tcp"], {capture: true});
        const match = output.match(/127\.0\.0\.1:(\d+)/);
        if (match) return match[1];
        await delay(250);
    }

    throw new Error(`Docker did not publish ${container} port 3000`);
}

async function waitForHealth(container) {
    for (let i = 0; i < 40; i++) {
        const status = await run("docker", [
            "inspect",
            "--format",
            "{{.State.Health.Status}}",
            container
        ], {capture: true});

        if (status === "healthy") return;
        if (status === "unhealthy") throw new Error(`${container} healthcheck failed`);
        await delay(500);
    }

    throw new Error(`Timed out waiting for ${container} to become healthy`);
}

async function waitForHttp(url) {
    for (let i = 0; i < 60; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // Retry until the container finishes booting.
        }

        await delay(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
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
        await import("node:fs/promises").then(fs => fs.access("/usr/bin/chromium"));
        return "/usr/bin/chromium";
    } catch {
        return "";
    }
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: new URL("..", import.meta.url),
            env: {...process.env, ...options.env},
            stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
        });
        let stdout = "";
        let stderr = "";

        if (options.capture) {
            child.stdout.on("data", chunk => stdout += chunk.toString("utf8"));
            child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
        }

        child.on("error", reject);
        child.on("close", code => {
            if (code === 0 || options.allowFailure) {
                resolve(stdout.trim());
            }
            else {
                reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stderr}`));
            }
        });
    });
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
