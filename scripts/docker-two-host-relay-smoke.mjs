import {
    launchOptions,
    mappedPort,
    run,
    waitForHealth,
    waitForHttp
} from "./docker-two-host-support.mjs";
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
const publicRelayUrls = parseRelayUrls(process.env.MESHDROP_DOCKER_PUBLIC_RELAY_URLS || "");
const publicRelayAttempts = parsePositiveInteger(process.env.MESHDROP_DOCKER_PUBLIC_RELAY_ATTEMPTS || "3");
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

async function runTwoHostTransfer(baseUrls, relayUrls) {
    const attempts = publicRelayUrls.length ? publicRelayAttempts : 1;
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await runTwoHostTransferAttempt(baseUrls, relayUrls, attempt);
            return;
        }
        catch (error) {
            lastError = error;
            if (attempt === attempts) break;
            console.warn(`Docker public relay transfer attempt ${attempt}/${attempts} failed: ${error.message.split("\n")[0]}`);
            await delay(1000 * attempt);
        }
    }

    throw lastError;
}

async function runTwoHostTransferAttempt([baseUrlA, baseUrlB], relayUrls, attempt) {
    const {chromium} = await loadPlaywright(playwrightModulePath);
    const browser = await chromium.launch(await launchOptions());
    const identities = createProofIdentityPair();
    const contextA = await browser.newContext({serviceWorkers: "block"});
    const contextB = await browser.newContext({serviceWorkers: "block"});
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageErrors = [
        ...watchPage(`docker-two-host-nostr-webrtc:${attempt}:sender`, pageA),
        ...watchPage(`docker-two-host-nostr-webrtc:${attempt}:receiver`, pageB)
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

        const senderPeerId = await waitForConnectedPeer(pageA, "nostr");
        const receiverPeerId = await waitForConnectedPeer(pageB, "nostr");
        await Promise.all([
            waitForOpenRtcPeer(pageA, senderPeerId, "sender"),
            waitForOpenRtcPeer(pageB, receiverPeerId, "receiver")
        ]);

        await sendProofIcon(pageA, senderPeerId);
        await waitForTransferAccepted(pageA, "sender");
        const received = await waitForReceivedFiles(pageB);
        await waitForFilesSent(pageA, "sender");

        assertReceived(received);
        assert(!pageErrors.length, `Docker two-host relay page errors:\n${pageErrors.join("\n")}`);
        const proofName = publicRelayUrls.length ? "docker-public-relay-two-host-webrtc" : "docker-two-host-nostr-webrtc";
        console.log(`Proof ${proofName}: nostr delivered meshdrop-proof-icon.svg between two Docker instances`);
    }
    catch (error) {
        throw new Error(
            `Docker two-host relay attempt ${attempt} failed: ${error.message}\n`
            + `sender=${JSON.stringify(await debugPageState(pageA))}\n`
            + `receiver=${JSON.stringify(await debugPageState(pageB))}`,
            {cause: error}
        );
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
            received: [],
            requests: [],
            accepted: 0,
            sent: 0
        };
        globalThis.__meshdropE2E = {peersManager: null};
        window.addEventListener("config", () => globalThis.__meshdropDockerTwoHost.configLoaded = true);
        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropDockerTwoHost.connected.push(event.detail.peerId);
        });
        window.addEventListener("files-transfer-request", event => {
            globalThis.__meshdropDockerTwoHost.requests.push({
                peerId: event.detail.peerId,
                header: event.detail.request?.header || [],
                totalSize: event.detail.request?.totalSize || 0
            });
            window.dispatchEvent(new CustomEvent("respond-to-files-transfer-request", {
                detail: {to: event.detail.peerId, accepted: true}
            }));
        });
        window.addEventListener("file-transfer-accepted", () => {
            globalThis.__meshdropDockerTwoHost.accepted += 1;
        });
        window.addEventListener("files-sent", () => {
            globalThis.__meshdropDockerTwoHost.sent += 1;
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

async function waitForOpenRtcPeer(page, peerId, role) {
    try {
        await page.waitForFunction(id => {
            const peer = globalThis.__meshdropE2E?.peersManager?.peers?.[id];
            return peer?._channel?.readyState === "open" && peer?._conn?.connectionState === "connected";
        }, peerId, {timeout: 30000});
    } catch (error) {
        throw new Error(`${role} RTC peer ${peerId} did not become open: ${error.message}`, {cause: error});
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

async function waitForTransferAccepted(page, role) {
    try {
        await page.waitForFunction(() => globalThis.__meshdropDockerTwoHost.accepted > 0, undefined, {timeout: 15000});
    } catch (error) {
        throw new Error(`${role} did not receive transfer acceptance: ${error.message}`, {cause: error});
    }
}

async function waitForFilesSent(page, role) {
    try {
        await page.waitForFunction(() => globalThis.__meshdropDockerTwoHost.sent > 0, undefined, {timeout: 15000});
    } catch (error) {
        throw new Error(`${role} did not observe files-sent: ${error.message}`, {cause: error});
    }
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
        requests: globalThis.__meshdropDockerTwoHost?.requests,
        accepted: globalThis.__meshdropDockerTwoHost?.accepted,
        sent: globalThis.__meshdropDockerTwoHost?.sent,
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

function parsePositiveInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
