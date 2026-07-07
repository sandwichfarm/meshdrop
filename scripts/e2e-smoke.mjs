import {spawn} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {WebSocketServer} from "ws";

const repoRoot = new URL("..", import.meta.url);
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const PROOF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#1b806a"/>
  <path d="M18 34 28 44 47 21" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const helpers = [];

async function main() {
    const appPort = await freePort();
    const relay = await startFakeRelay();
    const blossom = await startFakeBlossom();
    const fips = await startFakeFips();
    const pollen = await startFakePollenCli();
    const app = startApp(appPort, relay.port, blossom.port, fips.port, pollen);
    helpers.push(app);

    const baseUrl = `http://127.0.0.1:${appPort}`;
    const blossomServerUrl = `http://127.0.0.1:${blossom.port}`;
    await waitForHttp(`${baseUrl}/config`);

    const {chromium} = await loadPlaywright();
    const launchOptions = {headless: true};
    const executablePath = await resolveChromiumPath();
    if (executablePath) launchOptions.executablePath = executablePath;
    const browser = await chromium.launch(launchOptions);

    try {
        await runVisibilityScenario(browser, baseUrl);

        await runProofTransferScenario(browser, baseUrl, {
            name: "local-webrtc",
            roomType: "ip",
            transportId: "local"
        });

        await runProofTransferScenario(browser, baseUrl, {
            name: "blossom",
            roomType: "ip",
            transportId: "blossom",
            blossomServer: blossomServerUrl,
            setupSender: async page => {
                await connectNostrIdentity(page);
                await setProtocolServers(page, blossomServerUrl);
                await page.evaluate(() => globalThis.meshdropBlossomTransfer.enable());
                await page.waitForFunction(() => globalThis.meshdropBlossomTransfer.isActive());
            }
        });

        await runProofTransferScenario(browser, baseUrl, {
            name: "hashtree",
            roomType: "ip",
            transportId: "hashtree",
            blossomServer: blossomServerUrl,
            setupSender: async page => {
                await connectNostrIdentity(page);
                await setProtocolServers(page, blossomServerUrl);
                await page.evaluate(() => globalThis.meshdropHashtreeTransfer.enable());
                await page.waitForFunction(() => globalThis.meshdropHashtreeTransfer.isActive());
            }
        });

        await runProofTransferScenario(browser, baseUrl, {
            name: "pollen-storage",
            roomType: "ip",
            transportId: "pollen",
            setupBoth: async pages => {
                await Promise.all(pages.map(page => page.evaluate(() => globalThis.meshdropPollenTransfer.enable())));
                await Promise.all(pages.map(page => (
                    page.waitForFunction(() => globalThis.meshdropPollenTransfer.isActive())
                )));
            }
        });

        await runProofTransferScenario(browser, baseUrl, {
            name: "nostr-webrtc",
            roomType: "nostr",
            transportId: null,
            nostrOnly: true,
            setupBoth: async pages => {
                await Promise.all(pages.map(connectNostrIdentity));
                await Promise.all(pages.map(page => setFollowList(page)));
                await Promise.all(pages.map(page => page.evaluate(() => globalThis.meshdropNostrMesh.connect())));
                await Promise.all(pages.map(page => page.waitForFunction(() => globalThis.meshdropNostrMesh._active)));
            }
        });

        await runLocalRouteChoiceTransferScenario(browser, baseUrl);
        await retryScenario(
            "generic-fips-route-candidate",
            () => runGenericFipsRouteCandidateScenario(browser, relay.port, blossom.port, pollen)
        );
        await retryScenario(
            "federated-pollen-public-webrtc",
            () => runFederatedPollenWebRtcScenario(browser, relay.port, blossom.port, pollen)
        );
    }
    finally {
        await browser.close();
    }

    console.log(`Browser E2E smoke passed on ${baseUrl}`);
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

async function resolveChromiumPath() {
    if (chromiumPath !== undefined) return chromiumPath;

    const systemChromiumPath = "/usr/bin/chromium";
    try {
        await fs.access(systemChromiumPath);
        return systemChromiumPath;
    } catch {
        return "";
    }
}

async function runVisibilityScenario(browser, baseUrl) {
    const context = await newContext(browser, "unsigned", {signer: false});
    const page = await context.newPage();
    const logs = watchPages("visibility", [page]);

    try {
        await page.goto(baseUrl, {waitUntil: "domcontentloaded"});
        try {
            await waitForHydration(page);
        } catch (error) {
            throw new Error(`${error.message}\npageErrors=${logs.pageErrors.join("\n")}`);
        }
        await page.waitForFunction(() => !document.getElementById("fips-discovery").hasAttribute("hidden"));

        const visibility = await page.evaluate(() => ({
            nostrIdentity: document.getElementById("nostr-identity").hasAttribute("hidden"),
            nostrMesh: document.getElementById("nostr-mesh").hasAttribute("hidden"),
            blossom: document.getElementById("blossom-transfer").hasAttribute("hidden"),
            hashtree: document.getElementById("hashtree-transfer").hasAttribute("hidden"),
            fips: document.getElementById("fips-discovery").hasAttribute("hidden")
        }));

        assert(!visibility.nostrIdentity, "Nostr sign-in should stay visible for Remote Signer without NIP-07");
        assert(visibility.nostrMesh, "Nostr mesh should be hidden before sign-in");
        assert(visibility.blossom, "Blossom transfer should be hidden before sign-in");
        assert(visibility.hashtree, "Hashtree transfer should be hidden before sign-in");
        assert(!visibility.fips, "FIPS discovery should be visible when the daemon is reachable");
    }
    finally {
        await context.close();
    }
}

async function runProofTransferScenario(browser, baseUrl, options) {
    const contextA = await newContext(browser, `${options.name}-a`, {blossomServer: options.blossomServer || ""});
    const contextB = await newContext(browser, `${options.name}-b`, {blossomServer: options.blossomServer || ""});
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const logs = watchPages(options.name, [pageA, pageB]);

    try {
        await Promise.all([
            pageA.goto(baseUrl, {waitUntil: "domcontentloaded"}),
            pageB.goto(baseUrl, {waitUntil: "domcontentloaded"})
        ]);

        await Promise.all([waitForHydration(pageA), waitForHydration(pageB)]);
        if (options.nostrOnly) {
            await leaveIpRoom(pageA);
            await leaveIpRoom(pageB);
        }
        if (options.disableLocal) {
            await Promise.all([pageA, pageB].map(disableLocalDiscovery));
        }

        if (options.setupBoth) await options.setupBoth([pageA, pageB]);
        if (options.setupSender) await options.setupSender(pageA);
        if (options.setupReceiver) await options.setupReceiver(pageB);

        const peerId = await waitForConnectedPeer(pageA, options.roomType);
        await waitForConnectedPeer(pageB, options.roomType);
        await sendProofIcon(pageA, peerId, options.transportId);

        const received = await waitForReceivedFiles(pageB, 1, options.name);
        assertReceived({
            name: options.name,
            fileName: "meshdrop-proof-icon.svg",
            contents: [PROOF_ICON]
        }, received);
        assert(!logs.pageErrors.length, `${options.name}: page errors: ${logs.pageErrors.join("\n")}`);
        console.log(`Proof ${options.name}: ${options.transportId || "direct"} delivered meshdrop-proof-icon.svg`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function newContext(browser, identityName, options = {}) {
    const context = await browser.newContext({
        serviceWorkers: "block"
    });

    await context.addInitScript(({name, signer, blossomServer}) => {
        globalThis.__meshdropDisableNostrRelayNetwork = true;
        const originalConsoleError = console.error.bind(console);
        console.error = (...args) => originalConsoleError(...args.map(arg => arg?.stack || arg));

        const pubkey = name === "a" || name.endsWith("-a")
            ? "1".repeat(64)
            : "2".repeat(64);
        const displayName = `npub ${pubkey.slice(0, 8)}`;
        let counter = 0;

        if (signer) {
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

            localStorage.setItem("meshdrop_nostr_identity", JSON.stringify({
                pubkey,
                displayName,
                picture: "",
                relays: {read: [], write: []},
                blossomServers: blossomServer ? [blossomServer] : [],
                blossomServerListStatus: blossomServer ? "found" : "missing",
                followPubkeys: ["1".repeat(64), "2".repeat(64)],
                followListStatus: "found",
                event: {
                    kind: 27235,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ["client", "meshdrop"],
                        ["origin", location.origin],
                        ["name", displayName]
                    ],
                    content: "MeshDrop Nostr identity",
                    pubkey,
                    id: `${pubkey.slice(0, 32)}${"0".repeat(32)}`,
                    sig: "3".repeat(128)
                }
            }));
        }

        globalThis.__meshdropE2E = {
            connected: [],
            received: [],
            configLoaded: false,
            wsConnected: false
        };

        window.addEventListener("config", () => {
            globalThis.__meshdropE2E.configLoaded = true;
        });

        window.addEventListener("ws-connected", () => {
            globalThis.__meshdropE2E.wsConnected = true;
        });

        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropE2E.connected.push(event.detail.peerId);
        });

        window.addEventListener("files-transfer-request", event => {
            window.dispatchEvent(new CustomEvent("respond-to-files-transfer-request", {
                detail: {
                    to: event.detail.peerId,
                    accepted: true
                }
            }));
        });

        window.addEventListener("files-received", async event => {
            const files = await Promise.all(event.detail.files.map(async file => ({
                name: file.name,
                type: file.type,
                size: file.size,
                text: await file.text()
            })));
            globalThis.__meshdropE2E.received.push({peerId: event.detail.peerId, files});
        });
    }, {name: identityName, signer: options.signer !== false, blossomServer: options.blossomServer || ""});

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
            if (text === "rtc connection failed") return;
            const location = message.location();
            const source = location.url ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : "";
            const entry = `${label} console error: ${text}${source ? ` @ ${source}` : ""}`;
            pageErrors.push(entry);
            console.warn(entry);
        });
    });

    return {pageErrors};
}

async function waitForHydration(page) {
    await page.waitForFunction(() => (
        globalThis.meshdropNostrIdentity
        && globalThis.meshdropNostrMesh
        && globalThis.meshdropBlossomTransfer
        && globalThis.meshdropHashtreeTransfer
        && globalThis.meshdropPollenTransfer
        && globalThis.meshdropFipsDiscovery
        && globalThis.__meshdropE2E.configLoaded
        && globalThis.__meshdropE2E.wsConnected
        && document.querySelector("x-peers")
    ));
}

async function runLocalRouteChoiceTransferScenario(browser, baseUrl) {
    const contextA = await newContext(browser, "local-route-a");
    const contextB = await newContext(browser, "local-route-b");
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const logs = watchPages("local-route", [pageA, pageB]);

    try {
        await Promise.all([
            pageA.goto(baseUrl, {waitUntil: "domcontentloaded"}),
            pageB.goto(baseUrl, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([waitForHydration(pageA), waitForHydration(pageB)]);
        await Promise.all([
            pageA.evaluate(() => globalThis.meshdropFipsDiscovery.enable()),
            pageB.evaluate(() => globalThis.meshdropFipsDiscovery.enable())
        ]);

        const peerId = await waitForConnectedPeer(pageA, "ip");
        await pageA.evaluate(({to, payload}) => {
            const file = new File([payload], "local-route.txt", {type: "text/plain"});
            window.dispatchEvent(new CustomEvent("select-files-transport", {
                detail: {to, files: [file]}
            }));
            document.querySelector('[data-transport-id="local"]')?.click();
        }, {to: peerId, payload: "local-route-ok"});

        const received = await waitForReceivedFiles(pageB, 1);
        assertReceived({
            name: "local-route",
            fileName: "local-route.txt",
            contents: ["local-route-ok"]
        }, received);
        assert(!logs.pageErrors.length, `local-route: page errors: ${logs.pageErrors.join("\n")}`);
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function runGenericFipsRouteCandidateScenario(browser, relayPort, blossomPort, pollen) {
    const portA = await freePort();
    const portB = await freePort();
    const fipsA = await startFakeFips({ipv6Addr: "::1", peerName: "Server B"});
    const fipsB = await startFakeFips({ipv6Addr: "::1", peerName: "Server A"});
    const appA = startApp(portA, relayPort, blossomPort, fipsA.port, pollen, {
        args: [],
        serverId: "fed-a",
        fipsFederationPort: portB,
        fipsFederationUrl: `http://127.0.0.1:${portA}`,
        federationPollMs: 200
    });
    const appB = startApp(portB, relayPort, blossomPort, fipsB.port, pollen, {
        args: [],
        serverId: "fed-b",
        fipsFederationPort: portA,
        fipsFederationUrl: `http://127.0.0.1:${portB}`,
        federationPollMs: 200
    });
    helpers.push(appA, appB);

    const contextA = await newContext(browser, "fed-a");
    const contextB = await newContext(browser, "fed-b");
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const logs = watchPages("generic-fips", [pageA, pageB]);

    try {
        await openFederatedPages({pageA, pageB, portA, portB});
        await Promise.all([
            pageA.evaluate(() => globalThis.meshdropFipsDiscovery.enable()),
            pageB.evaluate(() => globalThis.meshdropFipsDiscovery.enable())
        ]);

        await delay(1500);
        const [stateA, stateB] = await Promise.all([debugPageState(pageA), debugPageState(pageB)]);
        const fipsPeers = [stateA, stateB].flatMap(state =>
            state.peers.filter(peer => peer.classes.includes("type-fips"))
        );
        assert(!fipsPeers.length, `generic FIPS peers created MeshDrop browser peers: ${JSON.stringify({stateA, stateB})}`);
        assert(!logs.pageErrors.length, `generic-fips: page errors: ${logs.pageErrors.join("\n")}`);
        console.log("Proof generic-fips-route-candidate: FIPS mesh peers stayed route candidates, not MeshDrop HTTP peers");
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close(), appA.close(), appB.close()]);
    }
}

async function runFederatedPollenWebRtcScenario(browser, relayPort, blossomPort, pollen) {
    const portA = await freePort();
    const portB = await freePort();
    const fipsA = await startFakeFips({ipv6Addr: "::1", peerName: "Server B"});
    const fipsB = await startFakeFips({ipv6Addr: "::1", peerName: "Server A"});
    const secretA = "00000000000000000000000000000000000000000000000000000000000000a1";
    const secretB = "00000000000000000000000000000000000000000000000000000000000000b2";
    const appA = startApp(portA, relayPort, blossomPort, fipsA.port, pollen, {
        args: [],
        serverId: "pollen-a",
        federationPollMs: 200,
        nostrSecretKey: secretA,
        pollenNostrBootstrap: "true",
        publicDiscovery: "true"
    });
    const appB = startApp(portB, relayPort, blossomPort, fipsB.port, pollen, {
        args: [],
        serverId: "pollen-b",
        federationPollMs: 200,
        nostrSecretKey: secretB,
        pollenNostrBootstrap: "true",
        publicDiscovery: "true"
    });
    helpers.push(appA, appB);

    const contextA = await newContext(browser, "fed-pollen-a");
    const contextB = await newContext(browser, "fed-pollen-b");
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const logs = watchPages("federated-pollen", [pageA, pageB]);

    try {
        await openFederatedPages({pageA, pageB, portA, portB});
        await Promise.all([disableLocalDiscovery(pageA), disableLocalDiscovery(pageB)]);
        await Promise.all([
            pageA.evaluate(() => globalThis.meshdropPollenTransfer.enable()),
            pageB.evaluate(() => globalThis.meshdropPollenTransfer.enable())
        ]);

        let peerId;
        try {
            peerId = await waitForConnectedPeer(pageA, "pollen");
        } catch (error) {
            const [stateA, stateB] = await Promise.all([debugPageState(pageA), debugPageState(pageB)]);
            throw new Error(`${error.message}\nserverA=${JSON.stringify(stateA)}\nserverB=${JSON.stringify(stateB)}`);
        }
        const receiverPeerId = await waitForConnectedPeer(pageB, "pollen");
        await Promise.all([
            waitForDirectRoute(pageA, peerId, "pollen"),
            waitForDirectRoute(pageB, receiverPeerId, "pollen")
        ]);
        await Promise.all([
            waitForHostCandidatePair(pageA, peerId, "federated-pollen sender"),
            waitForHostCandidatePair(pageB, receiverPeerId, "federated-pollen receiver")
        ]);
        await assertRouteChoice(pageA, peerId, {
            id: "pollen-mesh",
            label: "Pollen",
            privacy: "Pollen signaling, ICE data path",
            discoveryDetail: "SignalingPollen substrate",
            dataPathDetail: "Data pathbrowser WebRTC ICE"
        });
        await sendProofIcon(pageA, peerId, "pollen-mesh");

        const received = await waitForReceivedFiles(pageB, 1, "federated-pollen", [pageA, pageB]);
        assertReceived({
            name: "federated-pollen",
            fileName: "meshdrop-proof-icon.svg",
            contents: [PROOF_ICON]
        }, received);
        assert(!logs.pageErrors.length, `federated-pollen: page errors: ${logs.pageErrors.join("\n")}`);
        console.log("Proof federated-pollen-signaled-webrtc: Pollen discovery/signaling delivered meshdrop-proof-icon.svg across two MeshDrop servers using browser ICE data path");
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close(), appA.close(), appB.close()]);
    }
}

async function openFederatedPages({pageA, pageB, portA, portB}) {
    await Promise.all([
        waitForHttp(`http://127.0.0.1:${portA}/config`),
        waitForHttp(`http://127.0.0.1:${portB}/config`)
    ]);
    await Promise.all([
        pageA.goto(`http://127.0.0.1:${portA}`, {waitUntil: "domcontentloaded"}),
        pageB.goto(`http://127.0.0.1:${portB}`, {waitUntil: "domcontentloaded"})
    ]);
    await Promise.all([waitForHydration(pageA), waitForHydration(pageB)]);
}

async function connectNostrIdentity(page) {
    const hasIdentity = await page.evaluate(() => !!globalThis.meshdropNostrIdentity.getIdentity());
    if (hasIdentity) return;

    await page.evaluate(() => globalThis.meshdropNostrIdentity.connect());
    await page.waitForFunction(() => !!globalThis.meshdropNostrIdentity.getIdentity());
}

async function setProtocolServers(page, serverUrl) {
    await page.evaluate(url => {
        const identity = globalThis.meshdropNostrIdentity.getIdentity();
        identity.blossomServers = [url];
        identity.blossomServerListStatus = "found";
        globalThis.ProtocolServerPreferences.setProtocolEnabled(url, "blossom", true);
        globalThis.ProtocolServerPreferences.setProtocolEnabled(url, "hashtree", true);
        window.dispatchEvent(new CustomEvent("nostr-server-list-changed"));
    }, serverUrl);
}

async function setFollowList(page) {
    await page.evaluate(() => {
        const identity = globalThis.meshdropNostrIdentity.getIdentity();
        identity.followPubkeys = ["1".repeat(64), "2".repeat(64)];
        identity.followListStatus = "found";
    });
}

async function leaveIpRoom(page) {
    await page.evaluate(() => {
        const peerIds = [...document.querySelectorAll("x-peer.type-ip")].map(peer => peer.id);
        for (const peerId of peerIds) {
            window.dispatchEvent(new CustomEvent("peer-disconnected", {detail: peerId}));
        }
    });
}

async function disableLocalDiscovery(page) {
    await page.evaluate(() => globalThis.meshdropLocalDiscovery.setEnabled(false));
    try {
        await page.waitForFunction(() => !document.querySelector("x-peer.type-ip"), undefined, {timeout: 10000});
    } catch (error) {
        const state = await debugPageState(page);
        throw new Error(`${error.message}\nstate=${JSON.stringify(state)}`);
    }
}

async function waitForConnectedPeer(page, roomType) {
    try {
        const peerId = await page.waitForFunction(type => {
            const selector = type ? `x-peer.type-${type}` : "x-peer";
            const connected = new Set(globalThis.__meshdropE2E.connected || []);
            const peer = [...document.querySelectorAll(selector)].find(candidate => connected.has(candidate.id));
            return peer?.id || "";
        }, roomType, {timeout: 20000});

        return peerId.jsonValue();
    } catch (error) {
        const state = await safeDebugPageState(page);
        throw new Error(`${error.message}\nstate=${JSON.stringify(state)}`);
    }
}

async function waitForDirectRoute(page, peerId, roomType) {
    try {
        await page.waitForFunction(({id, type}) => {
            const peers = Object.values(globalThis.__meshdropE2E?.peersManager?.peers || {});
            const peer = peers.find(candidate => candidate._peerId === id);
            if (!peer || peer._peerId !== id) return false;
            return peer._roomIds?.[type]
                && peer._channel?.readyState === "open"
                && peer._busy === false;
        }, {id: peerId, type: roomType}, {timeout: 20000});
    } catch (error) {
        const state = await safeDebugPageState(page);
        throw new Error(`${roomType} route was not ready for ${peerId}: ${error.message}\nstate=${JSON.stringify(state)}`);
    }
}

async function waitForHostCandidatePair(page, peerId, role) {
    try {
        const handle = await page.waitForFunction(async id => {
            const peer = globalThis.__meshdropE2E?.peersManager?.peers?.[id];
            const connection = peer?._conn;
            if (!connection) return null;

            const stats = await connection.getStats();
            const reports = [...stats.values()];
            const transport = reports.find(report => report.type === "transport" && report.selectedCandidatePairId);
            const selectedPair = transport
                ? stats.get(transport.selectedCandidatePairId)
                : reports.find(report => report.type === "candidate-pair" && report.selected);
            if (!selectedPair || selectedPair.state !== "succeeded") return null;

            const local = stats.get(selectedPair.localCandidateId);
            const remote = stats.get(selectedPair.remoteCandidateId);
            if (local?.candidateType !== "host" || remote?.candidateType !== "host") return null;

            return {
                localType: local.candidateType,
                remoteType: remote.candidateType,
                localProtocol: local.protocol || "",
                remoteProtocol: remote.protocol || ""
            };
        }, peerId, {timeout: 20000});

        return handle.jsonValue();
    } catch (error) {
        const state = await safeDebugPageState(page);
        throw new Error(`${role} did not use a host/host ICE candidate pair: ${error.message}\nstate=${JSON.stringify(state)}`);
    }
}

async function assertRouteChoice(page, peerId, expected) {
    const options = await page.evaluate(({to, expectedId}) => {
        const file = new File(["route"], "route.txt", {type: "text/plain"});
        window.dispatchEvent(new CustomEvent("select-files-transport", {
            detail: {to, files: [file]}
        }));

        return [...document.querySelectorAll(".transport-choice-option")].map(option => ({
            id: option.dataset.transportId,
            label: option.querySelector(".transport-choice-label")?.textContent,
            privacy: option.querySelector(".transport-choice-privacy")?.textContent,
            details: [...option.querySelectorAll(".transport-choice-detail")].map(detail => detail.textContent),
            selected: option.dataset.transportId === expectedId
        }));
    }, {to: peerId, expectedId: expected.id});

    const option = options.find(candidate => candidate.id === expected.id);
    assert(option, `${expected.id} route was not selectable: ${JSON.stringify(options)}`);
    assert(option.label === expected.label, `${expected.id} label was ${option.label}`);
    assert(option.privacy === expected.privacy, `${expected.id} privacy was ${option.privacy}`);
    assert(option.details.includes(expected.discoveryDetail), `${expected.id} discovery details missing`);
    assert(option.details.includes(expected.dataPathDetail), `${expected.id} WebRTC details missing`);
}

async function debugPageState(page) {
    return page.evaluate(() => ({
        selfPeerId: sessionStorage.getItem("peer_id"),
        connected: globalThis.__meshdropE2E.connected,
        peers: [...document.querySelectorAll("x-peer")].map(peer => ({
            id: peer.id,
            classes: [...peer.classList]
        })),
        managerPeers: Object.values(globalThis.__meshdropE2E.peersManager?.peers || {}).map(peer => ({
            id: peer._peerId,
            isCaller: peer._isCaller,
            roomIds: peer._roomIds,
            channelState: peer._channel?.readyState || "",
            signalingState: peer._conn?.signalingState || "",
            iceConnectionState: peer._conn?.iceConnectionState || "",
            connectionState: peer._conn?.connectionState || "",
            signalSessionId: peer._signalSessionId || ""
        })),
        nostrActive: globalThis.meshdropNostrMesh?._active,
        relaySockets: globalThis.meshdropNostrMesh?._sockets?.size
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

async function sendProofIcon(page, peerId, transportId) {
    await page.evaluate(({to, transport, icon}) => {
        const file = new File([icon], "meshdrop-proof-icon.svg", {type: "image/svg+xml"});
        if (!transport) {
            window.dispatchEvent(new CustomEvent("files-selected", {
                detail: {to, files: [file]}
            }));
            return;
        }

        window.dispatchEvent(new CustomEvent("select-files-transport", {
            detail: {to, files: [file]}
        }));
        const button = document.querySelector(`[data-transport-id="${transport}"]`);
        if (!button) throw new Error(`Missing transport option ${transport}`);
        button.click();
    }, {
        to: peerId,
        transport: transportId,
        icon: PROOF_ICON
    });
}

async function waitForReceivedFiles(page, expectedCount, name = "transfer", debugPages = [page]) {
    let handle;
    try {
        handle = await page.waitForFunction(count => {
            const batch = globalThis.__meshdropE2E.received.at(-1);
            if (!batch || batch.files.length !== count) return null;
            return batch.files;
        }, expectedCount, {timeout: 45000});
    } catch (error) {
        const states = await Promise.all(debugPages.map(safeDebugPageState));
        throw new Error(`${name}: ${error.message}\nstates=${JSON.stringify(states)}`);
    }

    return handle.jsonValue();
}

async function retryScenario(name, run, attempts = 2) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await run();
        } catch (error) {
            lastError = error;
            if (attempt === attempts) break;
            console.warn(`${name} attempt ${attempt} failed, retrying: ${error.message}`);
            await delay(1000);
        }
    }

    throw lastError;
}

function assertReceived(options, received) {
    const texts = received.map(file => file.text);
    assert(
        JSON.stringify(texts) === JSON.stringify(options.contents),
        `${options.name}: received ${JSON.stringify(texts)}, expected ${JSON.stringify(options.contents)}`
    );

    assert(
        received.every(file => file.name.startsWith(options.fileName.replace(/\.[^.]+$/, ""))),
        `${options.name}: received unexpected file names ${received.map(file => file.name).join(", ")}`
    );
}

function startApp(port, relayPort, blossomPort, fipsPort, pollen, options = {}) {
    const child = spawn("node", ["server/index.js", ...(options.args || ["--localhost-only"])], {
        cwd: repoRoot,
        env: {
            ...process.env,
            PORT: String(port),
            MESHDROP_SERVER_ID: options.serverId || `e2e-${port}`,
            NOSTR_RELAYS: `ws://127.0.0.1:${relayPort}`,
            MESHDROP_NOSTR_SECRET_KEY: options.nostrSecretKey
                || "0000000000000000000000000000000000000000000000000000000000000001",
            BLOSSOM_SERVERS: `http://127.0.0.1:${blossomPort}`,
            FIPS_CONTROL_SOCKET: String(fipsPort),
            FIPS_FEDERATION_PORT: String(options.fipsFederationPort || port),
            FIPS_FEDERATION_URL: options.fipsFederationUrl || "",
            MESHDROP_FEDERATION_POLL_MS: String(options.federationPollMs || 15000),
            PLN_BIN: pollen.bin,
            PLN_DIR: pollen.dir,
            POLLEN_NOSTR_BOOTSTRAP: options.pollenNostrBootstrap || "false",
            MESHDROP_PUBLIC_DISCOVERY: options.publicDiscovery || "false",
            RTC_CONFIG: "false"
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", chunk => {
        if (process.env.MESHDROP_E2E_LOGS) process.stdout.write(chunk);
    });
    child.stderr.on("data", chunk => process.stderr.write(chunk));

    return {
        async close() {
            await stopChild(child);
        }
    };
}

async function startFakePollenCli() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-e2e-pln-"));
    const bin = path.join(dir, "pln");
    await fs.writeFile(bin, `#!/usr/bin/env node
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const args = process.argv.slice(2);
const command = args[0];
const dir = process.env.PLN_DIR || ".";
const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function servicePath(serviceName) {
  return path.join(dir, \`service-\${Buffer.from(serviceName).toString("hex")}.json\`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readService(serviceName) {
  const file = servicePath(serviceName);
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    sleep(50);
  }
  throw new Error(\`service not found: \${serviceName}\`);
}

if (command === "__proxy") {
  const localPort = Number.parseInt(args[1], 10);
  const targetPort = Number.parseInt(args[2], 10);
  const server = net.createServer(socket => {
    const target = net.connect(targetPort, "127.0.0.1");
    socket.pipe(target);
    target.pipe(socket);
    socket.on("error", () => target.destroy());
    target.on("error", () => socket.destroy());
  });
  server.listen(localPort, "127.0.0.1");
}
else if (command === "version") {
  console.log("v0.0.1-dev.21");
}
else if (command === "status") {
  console.log("ok");
}
else if (command === "seed") {
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, \`blob-\${hash}\`), fs.readFileSync(0));
  console.log(hash);
}
else if (command === "fetch") {
  fs.copyFileSync(path.join(dir, \`blob-\${args[1]}\`), args[2]);
}
else if (command === "serve") {
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(servicePath(args[2]), JSON.stringify({port: Number.parseInt(args[1], 10)}));
  console.log(\`served \${args[2]}\`);
}
else if (command === "connect") {
  const descriptor = readService(args[1]);
  const child = childProcess.spawn(process.execPath, [process.argv[1], "__proxy", args[2], String(descriptor.port)], {
    detached: true,
    env: process.env,
    stdio: "ignore"
  });
  child.unref();
  fs.appendFileSync(path.join(dir, "proxy-pids"), \`\${child.pid}\\n\`);
  sleep(200);
  console.log(\`forwarding localhost:\${args[2]} -> \${args[1]}\`);
}
else {
  console.log("ok");
}
`, {mode: 0o700});

    helpers.push({
        async close() {
            try {
                const pids = (await fs.readFile(path.join(dir, "proxy-pids"), "utf8"))
                    .split("\n")
                    .filter(Boolean)
                    .map(pid => Number.parseInt(pid, 10));
                for (const pid of pids) {
                    try {
                        process.kill(pid, "SIGTERM");
                    } catch {
                        // Proxy may already be gone.
                    }
                }
            } catch {
                // No proxy was started.
            }
            await fs.rm(dir, {recursive: true, force: true});
        }
    });

    return {bin, dir};
}

async function startFakeRelay() {
    const port = await freePort();
    const wss = new WebSocketServer({port, host: "127.0.0.1"});
    const subscriptions = new Map();
    const history = [];

    wss.on("connection", socket => {
        subscriptions.set(socket, new Map());
        socket.on("message", raw => {
            let message;
            try {
                message = JSON.parse(raw.toString("utf8"));
            } catch {
                return;
            }

            if (message[0] === "REQ" && message[1]) {
                const filters = message.slice(2).filter(filter => filter && typeof filter === "object");
                subscriptions.get(socket).set(message[1], filters);
                for (const event of history) {
                    if (matchesAnyRelayFilter(event, filters)) sendRelayEvent(socket, message[1], event);
                }
                return;
            }

            if (message[0] === "EVENT" && message[1]) {
                history.push(message[1]);
                for (const [client, clientSubscriptions] of subscriptions.entries()) {
                    for (const [subId, filters] of clientSubscriptions.entries()) {
                        if (matchesAnyRelayFilter(message[1], filters)) sendRelayEvent(client, subId, message[1]);
                    }
                }
            }
        });
        socket.on("close", () => subscriptions.delete(socket));
    });

    helpers.push({
        async close() {
            await new Promise(resolve => wss.close(resolve));
        }
    });

    return {port};
}

function matchesAnyRelayFilter(event, filters) {
    return filters.some(filter => matchesRelayFilter(event, filter));
}

function matchesRelayFilter(event, filter) {
    if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) return false;
    if (Number.isFinite(filter.since) && Number(event.created_at || 0) < filter.since) return false;
    if (!matchesTagFilter(event, filter, "p")) return false;
    if (!matchesTagFilter(event, filter, "r")) return false;
    return true;
}

function matchesTagFilter(event, filter, tagName) {
    const allowed = filter[`#${tagName}`];
    if (!Array.isArray(allowed)) return true;

    const values = (event.tags || [])
        .filter(tag => tag[0] === tagName)
        .map(tag => tag[1]);
    return values.some(value => allowed.includes(value));
}

function sendRelayEvent(socket, subscriptionId, event) {
    if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
    }
}

async function startFakeBlossom() {
    const port = await freePort();
    const objects = new Map();
    const origin = `http://127.0.0.1:${port}`;

    const server = http.createServer(async (request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-SHA-256");

        if (request.method === "OPTIONS") {
            response.writeHead(204).end();
            return;
        }

        if (request.method === "PUT" && request.url === "/upload") {
            const body = await readRequest(request);
            const sha256 = crypto.createHash("sha256").update(body).digest("hex");
            assert(request.headers["x-sha-256"] === sha256, "Blossom upload hash header mismatch");
            objects.set(sha256, {
                body,
                type: request.headers["content-type"] || "application/octet-stream"
            });

            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({
                url: `${origin}/${sha256}`,
                sha256,
                size: body.length,
                type: request.headers["content-type"] || "application/octet-stream",
                uploaded: Math.floor(Date.now() / 1000)
            }));
            return;
        }

        if (request.method === "GET") {
            const sha256 = request.url.slice(1);
            const object = objects.get(sha256);
            if (!object) {
                response.writeHead(404).end();
                return;
            }

            response.setHeader("Content-Type", object.type);
            response.end(object.body);
            return;
        }

        response.writeHead(405).end();
    });

    await listen(server, port);
    helpers.push({
        async close() {
            await closeServer(server);
        }
    });

    return {port};
}

async function startFakeFips(options = {}) {
    const peerIpv6Addr = options.ipv6Addr || "fd00::2";
    const localIpv6Addr = options.localIpv6Addr || "fd00::1";
    const peerName = options.peerName || "FIPS peer";
    const port = await freePort();
    const server = net.createServer(socket => {
        let buffered = "";
        socket.on("error", () => {
            // E2E clients can disconnect while a poll is in flight.
        });
        socket.on("data", chunk => {
            buffered += chunk.toString("utf8");
            if (!buffered.includes("\n")) return;

            const request = JSON.parse(buffered.split("\n")[0]);
            if (request.command === "show_status") {
                socket.end(JSON.stringify({
                    status: "ok",
                    data: {
                        npub: "npub1e2esmoke",
                        ipv6_addr: localIpv6Addr,
                        peer_count: 1,
                        estimated_mesh_size: 2
                    }
                }) + "\n");
                return;
            }

            if (request.command === "show_peers") {
                socket.end(JSON.stringify({
                    status: "ok",
                    data: {
                        peers: [{
                            npub: "npub1peer",
                            display_name: peerName,
                            ipv6_addr: peerIpv6Addr,
                            connectivity: "direct",
                            transport_type: "webrtc",
                            transport_addr: "127.0.0.1",
                            direction: "outbound",
                            tree_depth: 1
                        }]
                    }
                }) + "\n");
                return;
            }

            socket.end(JSON.stringify({status: "error", message: "unknown command"}) + "\n");
        });
    });

    await listen(server, port, "127.0.0.1");
    helpers.push({
        async close() {
            await closeServer(server);
        }
    });

    return {port};
}

function readRequest(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("error", reject);
        request.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

async function waitForHttp(url) {
    for (let i = 0; i < 80; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // Retry until the app server is ready.
        }

        await delay(250);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

async function freePort() {
    const server = net.createServer();
    await listen(server, 0, "127.0.0.1");
    const port = server.address().port;
    await closeServer(server);
    return port;
}

function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
            server.off("error", reject);
            resolve();
        });
    });
}

function closeServer(server) {
    return new Promise(resolve => server.close(resolve));
}

function stopChild(child) {
    return new Promise(resolve => {
        if (child.exitCode !== null) {
            resolve();
            return;
        }

        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
        }, 3000);

        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill("SIGTERM");
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

main()
    .catch(async error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await Promise.allSettled([...helpers].reverse().map(helper => helper.close()));
    });
