import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/scripts/network.js", import.meta.url), "utf8");

function createHarness() {
    const connections = [];
    const fired = [];
    let sessionIndex = 0;

    class FakeRTCPeerConnection {
        constructor(config = {}) {
            this.config = config;
            this.signalingState = "stable";
            this.connectionState = "new";
            this.iceConnectionState = "new";
            this.dataChannels = [];
            connections.push(this);
        }

        createDataChannel(label) {
            const channel = {label, readyState: "connecting", send() {}, close() {}};
            this.dataChannels.push(channel);
            return channel;
        }

        createOffer() {
            return Promise.resolve({type: "offer", sdp: "offer-sdp"});
        }

        setLocalDescription(description) {
            this.localDescription = description;
            this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
            return Promise.resolve();
        }

        close() {
            this.signalingState = "closed";
            this.connectionState = "closed";
        }
    }

    const context = {
        console,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        URL,
        window: {isRtcSupported: true},
        location: {protocol: "http:", host: "meshdrop.test", pathname: "/"},
        navigator: {onLine: true},
        sessionStorage: {getItem: () => null, setItem() {}},
        localStorage: {getItem: () => null},
        crypto: {randomUUID: () => `session-${++sessionIndex}`},
        cyrb53: () => 1,
        Events: {
            on() {},
            fire(type, detail) {
                fired.push({type, detail});
            }
        },
        BrowserTabsConnector: {
            peerIsSameBrowser: () => false,
            addPeerIdToLocalStorage: () => Promise.resolve("self"),
            removeOtherPeerIdsFromLocalStorage: () => Promise.resolve([])
        },
        PersistentStorage: {
            getRoomSecretEntry: () => Promise.resolve(null),
            deleteRoomSecret: () => Promise.resolve(null),
            getAllRoomSecrets: () => Promise.resolve([])
        },
        mime: {
            addMissingMimeTypesToFiles: files => files
        },
        RTCPeerConnection: FakeRTCPeerConnection,
        RTCIceCandidate: function RTCIceCandidate(candidate) {
            return {...candidate};
        }
    };
    context.globalThis = context;
    vm.runInNewContext(`${source}\nglobalThis.__meshdropSmoke = {PeersManager};`, context);
    return {context, connections, fired, PeersManager: context.__meshdropSmoke.PeersManager};
}

function bridgeDescriptor(routeType, roomId) {
    return {
        routeType,
        rooms: [roomId],
        iceBridge: {
            kind: "ice-bridge",
            supported: true,
            source: "instance",
            bridgeRole: `${routeType}-instance-ice-bridge`,
            rtcConfig: {
                iceServers: [{urls: `turn:${routeType}-instance-bridge.test:3478?transport=tcp`}]
            },
            topologyEvidence: {
                overlay: routeType,
                instance: "meshdrop-instance-a"
            }
        }
    };
}

async function proveRoute(routeType) {
    const {context, connections, fired, PeersManager} = createHarness();
    const roomId = `${routeType}-room`;
    const peerPubkey = `${routeType === "fips" ? "f" : "p"}`.repeat(64);
    const controllerName = routeType === "fips" ? "meshdropFipsDiscovery" : "meshdropPollenTransfer";
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    context[controllerName] = {
        routeMetadataForRoom(candidateRoomId) {
            return candidateRoomId === roomId ? bridgeDescriptor(routeType, roomId) : null;
        }
    };

    const manager = new PeersManager({send() {}});
    manager._onWsConfig({
        rtcConfig: {
            iceServers: [{urls: "stun:clearnet-default.invalid:19302"}]
        },
        wsFallback: false
    });
    manager._onPeerJoined({
        peer: {
            id: peerPubkey,
            rtcSupported: true,
            routeCapabilities: [routeType],
            nostrIdentity: {pubkey: peerPubkey}
        },
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });
    manager._onPeerJoined({
        peer: {
            id: `${routeType}-peer`,
            rtcSupported: true,
            nostrIdentity: {pubkey: peerPubkey}
        },
        isCaller: true,
        roomType: routeType,
        roomId,
        transport: {send() {}}
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(connections.length, 1, `${routeType} did not create an RTC connection`);
    assert.equal(connections[0].config.iceTransportPolicy, "relay");
    assert.deepEqual(connections[0].config.iceServers, [{
        urls: `turn:${routeType}-instance-bridge.test:3478?transport=tcp`
    }]);
    assert.equal(
        JSON.stringify(connections[0].config).includes("stun:clearnet-default.invalid"),
        false,
        `${routeType} kept default Clearnet ICE config`
    );

    const status = fired.find(event => event.type === "peer-route-status"
        && event.detail.route === routeType
        && event.detail.reason === "instance-ice-bridge");
    assert(status, `${routeType} did not report instance ICE bridge selection`);

    return {
        routeType,
        bridgeRole: status.detail.routeMetadata.iceBridge.bridgeRole,
        iceTransportPolicy: connections[0].config.iceTransportPolicy,
        iceServers: connections[0].config.iceServers,
        defaultClearnetIcePresent: false
    };
}

const proofs = [
    await proveRoute("fips"),
    await proveRoute("pollen")
];

console.log(`Proof instance-ice-bridge: ${JSON.stringify({
    selectedRouteSetup: true,
    provenTransfer: false,
    proofs
})}`);
