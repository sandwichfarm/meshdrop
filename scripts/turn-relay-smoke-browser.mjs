import {Buffer} from "node:buffer";
import crypto from "node:crypto";

const pageTimeoutMs = 45000;

export async function runRelayTransfer(browser, baseUrl) {
    const contextA = await newContext(browser);
    const contextB = await newContext(browser);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageErrors = [
        ...watchPage("turn-relay-webrtc:sender", pageA),
        ...watchPage("turn-relay-webrtc:receiver", pageB)
    ];
    const proofFile = {
        name: "meshdrop-turn-relay-webrtc-proof.txt",
        text: [
            "MeshDrop TURN relay proof",
            `pid=${process.pid}`,
            `time=${new Date().toISOString()}`
        ].join("\n")
    };

    try {
        await Promise.all([
            pageA.goto(baseUrl, {waitUntil: "domcontentloaded"}),
            pageB.goto(baseUrl, {waitUntil: "domcontentloaded"})
        ]);
        await Promise.all([waitForHydration(pageA, "sender"), waitForHydration(pageB, "receiver")]);
        await Promise.all([
            pageA.evaluate(() => globalThis.Events.fire("join-ip-room")),
            pageB.evaluate(() => globalThis.Events.fire("join-ip-room"))
        ]);

        const senderPeerId = await waitForConnectedPeer(pageA, "ip", "sender");
        const receiverPeerId = await waitForConnectedPeer(pageB, "ip", "receiver");
        await Promise.all([
            waitForOpenRtcPeer(pageA, senderPeerId, "sender"),
            waitForOpenRtcPeer(pageB, receiverPeerId, "receiver")
        ]);

        await sendProofFile(pageA, senderPeerId, proofFile);
        const received = await waitForReceivedFiles(pageB, "receiver");
        assertReceived(received, proofFile);

        const senderPair = await waitForRelayCandidatePair(pageA, senderPeerId, "sender");
        const receiverPair = await waitForRelayCandidatePair(pageB, receiverPeerId, "receiver");
        const bytes = Buffer.byteLength(proofFile.text);
        const hash = crypto.createHash("sha256").update(proofFile.text).digest("hex");
        const proof = {
            senderRuntime: "browser-a",
            recipientRuntime: "browser-b",
            routeType: "turn-relay",
            dataPlanePrimitive: "webrtc-relay-ice",
            webRtcUsed: true,
            instanceRelayed: false,
            bytesSent: bytes,
            bytesReceived: bytes,
            hashMatched: crypto.createHash("sha256").update(received[0].text).digest("hex") === hash,
            fallbackUsed: false,
            selectedIceCandidateType: "relay",
            selectedCandidatePairs: {
                sender: senderPair,
                receiver: receiverPair
            }
        };
        const validation = await pageB.evaluate(candidateProof => (
            globalThis.MeshDropRouteContract.validateRouteProof(candidateProof)
        ), proof);

        assert(validation.ok === true, `route proof validation failed: ${JSON.stringify(validation)}`);
        assert(!pageErrors.length, `TURN relay page errors:\n${pageErrors.join("\n")}`);

        return proof;
    }
    catch (error) {
        throw new Error(
            `TURN relay transfer failed: ${error.message}\n`
            + `sender=${JSON.stringify(await debugPageState(pageA))}\n`
            + `receiver=${JSON.stringify(await debugPageState(pageB))}`,
            {cause: error}
        );
    }
    finally {
        await Promise.allSettled([contextA.close(), contextB.close()]);
    }
}

async function newContext(browser) {
    const context = await browser.newContext({serviceWorkers: "block"});
    context.setDefaultTimeout(pageTimeoutMs);
    context.setDefaultNavigationTimeout(pageTimeoutMs);
    await context.addInitScript(() => {
        globalThis.__meshdropTurnRelay = {
            configLoaded: false,
            wsConnected: false,
            connected: [],
            received: [],
            accepted: 0,
            sent: 0,
            wsLogs: []
        };
        globalThis.__meshdropE2E = {peersManager: null};
        globalThis.__meshdropDisableNostrRelayNetwork = true;
        const originalLog = console.log.bind(console);
        console.log = (...args) => {
            const first = String(args[0] || "");
            if (first.startsWith("WS ")) {
                globalThis.__meshdropTurnRelay.wsLogs.push(args.map(arg => {
                    if (typeof arg === "string") return arg;
                    try {
                        return JSON.stringify(arg);
                    }
                    catch {
                        return String(arg);
                    }
                }).join(" "));
            }
            originalLog(...args);
        };
        window.addEventListener("config", () => {
            globalThis.__meshdropTurnRelay.configLoaded = true;
        });
        window.addEventListener("ws-connected", () => {
            globalThis.__meshdropTurnRelay.wsConnected = true;
        });
        window.addEventListener("peer-connected", event => {
            globalThis.__meshdropTurnRelay.connected.push(event.detail.peerId);
        });
        window.addEventListener("files-transfer-request", event => {
            window.dispatchEvent(new CustomEvent("respond-to-files-transfer-request", {
                detail: {to: event.detail.peerId, accepted: true}
            }));
        });
        window.addEventListener("file-transfer-accepted", () => {
            globalThis.__meshdropTurnRelay.accepted += 1;
        });
        window.addEventListener("files-sent", () => {
            globalThis.__meshdropTurnRelay.sent += 1;
        });
        window.addEventListener("files-received", async event => {
            const files = await Promise.all(event.detail.files.map(async file => ({
                name: file.name,
                text: await file.text()
            })));
            globalThis.__meshdropTurnRelay.received.push({peerId: event.detail.peerId, files});
        });
    });
    return context;
}

function watchPage(label, page) {
    const errors = [];
    page.on("pageerror", error => errors.push(`${label}: ${error.stack || error.message}`));
    page.on("console", message => {
        if (message.type() !== "error") return;
        errors.push(`${label} console error: ${message.text()}`);
    });
    return errors;
}

async function waitForHydration(page, role) {
    try {
        await page.waitForFunction(() => (
            globalThis.__meshdropTurnRelay?.configLoaded
            && globalThis.__meshdropTurnRelay?.wsConnected
            && globalThis.__meshdropE2E?.peersManager
            && globalThis.__meshdropE2E.peersManager._wsConfig?.rtcConfig?.iceTransportPolicy === "relay"
            && document.querySelector("x-peers")
        ), undefined, {timeout: pageTimeoutMs});
    }
    catch (error) {
        throw new Error(`${role} hydration failed: ${error.message}\nstate=${JSON.stringify(await debugPageState(page))}`);
    }
}

async function waitForConnectedPeer(page, roomType, role) {
    try {
        const handle = await page.waitForFunction(type => {
            const selector = type ? `x-peer.type-${type}` : "x-peer";
            const connected = new Set(globalThis.__meshdropTurnRelay?.connected || []);
            const peer = [...document.querySelectorAll(selector)].find(candidate => connected.has(candidate.id));
            return peer?.id || "";
        }, roomType, {timeout: pageTimeoutMs});
        return handle.jsonValue();
    }
    catch (error) {
        throw new Error(`${role} did not connect: ${error.message}\nstate=${JSON.stringify(await debugPageState(page))}`);
    }
}

async function waitForOpenRtcPeer(page, peerId, role) {
    try {
        await page.waitForFunction(id => {
            const peer = globalThis.__meshdropE2E?.peersManager?.peers?.[id];
            return peer?._channel?.readyState === "open" && peer?._conn?.connectionState === "connected";
        }, peerId, {timeout: pageTimeoutMs});
    }
    catch (error) {
        throw new Error(`${role} RTC did not open: ${error.message}\nstate=${JSON.stringify(await debugPageState(page))}`);
    }
}

async function sendProofFile(page, peerId, proofFile) {
    await page.evaluate(({to, proof}) => {
        const file = new File([proof.text], proof.name, {type: "text/plain"});
        window.dispatchEvent(new CustomEvent("select-files-transport", {detail: {to, files: [file]}}));
        const button = document.querySelector('[data-transport-id="local"]');
        if (!button) throw new Error("Missing local transport option");
        button.click();
    }, {to: peerId, proof: proofFile});
}

async function waitForReceivedFiles(page, role) {
    try {
        const handle = await page.waitForFunction(() => {
            const batch = globalThis.__meshdropTurnRelay?.received?.at(-1);
            if (!batch || batch.files.length !== 1) return null;
            return batch.files;
        }, undefined, {timeout: pageTimeoutMs});
        return handle.jsonValue();
    }
    catch (error) {
        throw new Error(`${role} did not receive proof file: ${error.message}\nstate=${JSON.stringify(await debugPageState(page))}`);
    }
}

async function waitForRelayCandidatePair(page, peerId, role) {
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
            if (local?.candidateType !== "relay" || remote?.candidateType !== "relay") return null;

            return {
                localType: local.candidateType,
                remoteType: remote.candidateType,
                localProtocol: local.protocol || "",
                remoteProtocol: remote.protocol || ""
            };
        }, peerId, {timeout: pageTimeoutMs});
        return handle.jsonValue();
    }
    catch (error) {
        throw new Error(`${role} did not use relay ICE candidates: ${error.message}\nstate=${JSON.stringify(await debugPageState(page))}`);
    }
}

function assertReceived(received, proofFile) {
    const file = received[0];
    assert(file.name === proofFile.name, `received unexpected file ${file.name}`);
    assert(file.text === proofFile.text, "received proof file contents did not match");
}

async function debugPageState(page) {
    return page.evaluate(() => ({
        connected: globalThis.__meshdropTurnRelay?.connected,
        received: globalThis.__meshdropTurnRelay?.received,
        accepted: globalThis.__meshdropTurnRelay?.accepted,
        sent: globalThis.__meshdropTurnRelay?.sent,
        configLoaded: globalThis.__meshdropTurnRelay?.configLoaded,
        wsConnected: globalThis.__meshdropTurnRelay?.wsConnected,
        wsLogs: globalThis.__meshdropTurnRelay?.wsLogs,
        rtcConfig: globalThis.__meshdropE2E?.peersManager?._wsConfig?.rtcConfig,
        peers: [...document.querySelectorAll("x-peer")].map(peer => ({
            id: peer.id,
            classes: [...peer.classList]
        })),
        managerPeers: Object.values(globalThis.__meshdropE2E?.peersManager?.peers || {}).map(peer => ({
            id: peer._peerId,
            roomIds: peer._roomIds,
            channelState: peer._channel?.readyState || "",
            connectionState: peer._conn?.connectionState || "",
            iceConnectionState: peer._conn?.iceConnectionState || ""
        }))
    }));
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
