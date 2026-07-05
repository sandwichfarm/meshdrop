import {evaluate} from "./android-webview-devtools.mjs";
import {createProofIdentityPair} from "./spa-smoke-support.mjs";

export function createAndroidCallerIdentityPair() {
    for (let i = 0; i < 20; i += 1) {
        const identities = createProofIdentityPair();
        if (identities.a.pubkey > identities.b.pubkey) return identities;
    }

    throw new Error("Failed to create proof identities with Android as WebRTC caller");
}

export async function addBrowserInitScript(page, identity, relayUrls) {
    await page.addInitScript(initScriptSource({
        identity: {
            pubkey: identity.pubkey,
            displayName: identity.displayName,
            followPubkeys: identity.followPubkeys
        },
        relayUrls,
        targetName: "android"
    }));
}

export async function androidDebugState(cdp) {
    return evaluate(cdp, debugStateSource()).catch(error => ({error: error.message}));
}

export async function browserDebugState(page) {
    return page.evaluate(debugStateSource());
}

export function watchBrowserPage(name, page) {
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

function debugStateSource() {
    return `(() => ({
        config: globalThis.__meshdropE2E?.config?.capabilities?.runtime,
        connected: globalThis.__meshdropE2E?.connected,
        joined: globalThis.__meshdropE2E?.joined,
        lastSignal: globalThis.__meshdropE2E?.lastSignal,
        received: globalThis.__meshdropE2E?.received,
        rtc: {
            supported: window.isRtcSupported,
            peerConnection: typeof RTCPeerConnection
        },
        nostrMesh: {
            active: globalThis.meshdropNostrMesh?._active,
            connecting: globalThis.meshdropNostrMesh?._connecting,
            relaySockets: globalThis.meshdropNostrMesh?._sockets?.size,
            relaySocketStates: [...(globalThis.meshdropNostrMesh?._sockets?.values() || [])].map(socket => socket.readyState),
            peers: [...(globalThis.meshdropNostrMesh?._peers || [])],
            identity: {
                pubkey: globalThis.meshdropNostrMesh?._identity?.pubkey || "",
                followListStatus: globalThis.meshdropNostrMesh?._identity?.followListStatus || "",
                followPubkeys: globalThis.meshdropNostrMesh?._identity?.followPubkeys || []
            }
        },
        identity: {
            pubkey: globalThis.meshdropNostrIdentity?.getIdentity?.()?.pubkey || "",
            followListStatus: globalThis.meshdropNostrIdentity?.getIdentity?.()?.followListStatus || "",
            followPubkeys: globalThis.meshdropNostrIdentity?.getIdentity?.()?.followPubkeys || []
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
        })),
        peersManager: {
            hasWsConfig: !!globalThis.__meshdropE2E?.peersManager?._wsConfig,
            pendingPeerMessages: globalThis.__meshdropE2E?.peersManager?._pendingPeerMessages?.length || 0
        }
    }))()`;
}

export function initScriptSource({identity, relayUrls, targetName}) {
    return `(() => {
        const proofIdentity = ${JSON.stringify(identity)};
        const relays = ${JSON.stringify(relayUrls)};
        const targetName = ${JSON.stringify(targetName)};
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
                tags: [["client", "meshdrop"], ["target", targetName], ["origin", location.origin]],
                content: "MeshDrop Android WebView transfer identity",
                pubkey: proofIdentity.pubkey,
                id: proofIdentity.pubkey.slice(0, 32) + "0".repeat(32),
                sig: "4".repeat(128)
            }
        }));
        globalThis.__meshdropSignedEventResolvers = {};
        globalThis.__meshdropResolveSignedEvent = (id, signedEvent) => {
            const resolver = globalThis.__meshdropSignedEventResolvers[id];
            if (!resolver) return false;
            delete globalThis.__meshdropSignedEventResolvers[id];
            resolver(signedEvent);
            return true;
        };
        globalThis.nostr = {
            getPublicKey: async () => proofIdentity.pubkey,
            signEvent: async event => {
                if (typeof globalThis.__meshdropSignEvent === "function") {
                    return globalThis.__meshdropSignEvent(event);
                }
                const id = String(Date.now()) + Math.random().toString(16).slice(2);
                return new Promise(resolve => {
                    globalThis.__meshdropSignedEventResolvers[id] = resolve;
                    globalThis.__meshdropCdpSignEvent(JSON.stringify({id, event}));
                });
            },
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
            joined: [],
            received: []
        };
        globalThis.__meshdropRestoreProofFollowList = () => {
            const controller = globalThis.meshdropNostrIdentity;
            const identity = controller?.getIdentity?.();
            if (!identity || identity.pubkey !== proofIdentity.pubkey) return false;
            identity.followPubkeys = proofIdentity.followPubkeys;
            identity.followListStatus = "found";
            if (globalThis.meshdropNostrMesh?._identity?.pubkey === proofIdentity.pubkey) {
                globalThis.meshdropNostrMesh._identity.followPubkeys = proofIdentity.followPubkeys;
                globalThis.meshdropNostrMesh._identity.followListStatus = "found";
            }
            localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(identity));
            return true;
        };
        window.addEventListener("nostr-identity-changed", () => {
            globalThis.__meshdropRestoreProofFollowList();
        });
        if (typeof pairDrop !== "undefined" && pairDrop?.peers) {
            globalThis.__meshdropE2E.peersManager = pairDrop.peers;
        }
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
        window.addEventListener("peer-joined", event => {
            globalThis.__meshdropE2E.joined.push({
                peerId: event.detail.peer?.id || "",
                roomType: event.detail.roomType || "",
                roomId: event.detail.roomId || "",
                isCaller: event.detail.isCaller
            });
        });
        window.addEventListener("signal", event => {
            globalThis.__meshdropE2E.lastSignal = {
                sender: event.detail?.sender?.id || "",
                sdp: event.detail?.sdp?.type || "",
                ice: !!event.detail?.ice
            };
        });
        window.addEventListener("ws-config", event => {
            globalThis.__meshdropE2E.wsConfig = event.detail;
        });
    })();`;
}
