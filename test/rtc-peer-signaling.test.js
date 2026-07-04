import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/scripts/network.js", import.meta.url), "utf8");

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function createHarness() {
    const fired = [];
    const warnings = [];
    const errors = [];
    const connections = [];
    let sessionIndex = 0;

    class FakeRTCPeerConnection {
        constructor() {
            this.signalingState = "stable";
            this.connectionState = "new";
            this.iceConnectionState = "new";
            this.localDescription = null;
            this.remoteDescription = null;
            this.remoteDescriptions = [];
            this.iceCandidates = [];
            this.dataChannels = [];
            connections.push(this);
        }

        createDataChannel(label) {
            const channel = {
                label,
                readyState: "connecting",
                send() {},
                close() {
                    this.readyState = "closed";
                    this.onclose?.();
                }
            };
            this.dataChannels.push(channel);
            return channel;
        }

        createOffer() {
            return Promise.resolve({type: "offer", sdp: "offer-sdp"});
        }

        createAnswer() {
            return Promise.resolve({type: "answer", sdp: "answer-sdp"});
        }

        setLocalDescription(description) {
            this.localDescription = description;
            this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
            return Promise.resolve();
        }

        setRemoteDescription(description) {
            this.remoteDescription = description;
            this.remoteDescriptions.push(description);
            this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
            return Promise.resolve();
        }

        addIceCandidate(candidate) {
            this.iceCandidates.push(candidate);
            return Promise.resolve();
        }

        close() {
            this.signalingState = "closed";
            this.connectionState = "closed";
        }
    }

    const context = {
        console: {
            log() {},
            warn: (...args) => warnings.push(args),
            error: (...args) => errors.push(args)
        },
        setTimeout,
        clearTimeout,
        Date,
        Math,
        URL,
        window: {isRtcSupported: true},
        location: {protocol: "http:", host: "meshdrop.test", pathname: "/"},
        navigator: {},
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

    vm.runInNewContext(`${source}\nglobalThis.__meshdropTest = {RTCPeer, PeersManager};`, context);

    return {
        RTCPeer: context.__meshdropTest.RTCPeer,
        PeersManager: context.__meshdropTest.PeersManager,
        context,
        connections,
        fired,
        warnings,
        errors
    };
}

test("RTC signaling tags locally created offers with a negotiation session", async () => {
    const {RTCPeer} = createHarness();
    const sent = [];

    new RTCPeer({send: message => sent.push(message)}, true, "peer-a", "nostr", "room", {});
    await flushPromises();

    assert.equal(sent.length, 1);
    assert.equal(sent[0].sdp.type, "offer");
    assert.equal(sent[0].sessionId, "session-1");
});

test("RTC signaling ignores stale answers and candidates from another negotiation", async () => {
    const {RTCPeer, connections, errors} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "nostr", "room", {});
    await flushPromises();

    peer.onServerMessage({sessionId: "old-session", sdp: {type: "answer", sdp: "old-answer"}});
    peer.onServerMessage({sessionId: "old-session", ice: {candidate: "old-candidate"}});
    await flushPromises();

    assert.equal(connections[0].remoteDescriptions.length, 0);
    assert.equal(connections[0].iceCandidates.length, 0);
    assert.deepEqual(errors, []);
});

test("RTC signaling accepts legacy sessionless answers for the active local offer", async () => {
    const {RTCPeer, connections, errors} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "nostr", "room", {});
    await flushPromises();

    peer.onServerMessage({sdp: {type: "answer", sdp: "legacy-answer"}});
    await flushPromises();

    assert.equal(connections[0].remoteDescriptions.length, 1);
    assert.equal(connections[0].remoteDescription.sdp, "legacy-answer");
    assert.deepEqual(errors, []);
});

test("RTC signaling buffers ICE until the matching remote offer is applied", async () => {
    const {RTCPeer, connections} = createHarness();
    const sent = [];
    const peer = new RTCPeer({send: message => sent.push(message)}, false, "peer-a", "nostr", "room", {});

    peer.onServerMessage({sessionId: "remote-session", ice: {candidate: "candidate-1"}});
    assert.equal(connections[0].iceCandidates.length, 0);

    peer.onServerMessage({sessionId: "remote-session", sdp: {type: "offer", sdp: "offer-sdp"}});
    await flushPromises();

    assert.equal(connections[0].remoteDescriptions.length, 1);
    assert.equal(connections[0].iceCandidates.length, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].sdp.type, "answer");
    assert.equal(sent[0].sessionId, "remote-session");
});

test("RTC signaling ignores late local answers after negotiation already settled", async () => {
    const {RTCPeer, connections, errors} = createHarness();
    const sent = [];
    const peer = new RTCPeer({send: message => sent.push(message)}, false, "peer-a", "nostr", "room", {});

    peer.onServerMessage({sessionId: "remote-session", sdp: {type: "offer", sdp: "offer-sdp"}});
    await flushPromises();
    connections[0].localDescription = null;
    sent.length = 0;
    connections[0].signalingState = "stable";
    peer._onDescription({type: "answer", sdp: "late-answer"});
    await flushPromises();

    assert.equal(connections[0].localDescription, null);
    assert.deepEqual(sent, []);
    assert.deepEqual(errors, []);
});

test("RTC signaling ignores async stale-answer InvalidStateError", async () => {
    const {RTCPeer, connections, errors} = createHarness();
    const sent = [];
    const peer = new RTCPeer({send: message => sent.push(message)}, false, "peer-a", "nostr", "room", {});
    let setLocalAttempts = 0;

    peer.onServerMessage({sessionId: "remote-session", sdp: {type: "offer", sdp: "offer-sdp"}});
    connections[0].setLocalDescription = description => {
        setLocalAttempts += 1;
        if (description.type === "answer") {
            const error = new Error(
                "Failed to execute 'setLocalDescription' on 'RTCPeerConnection': Called in wrong state: stable"
            );
            error.name = "InvalidStateError";
            connections[0].signalingState = "stable";
            return Promise.reject(error);
        }
        return Promise.resolve();
    };
    await flushPromises();

    assert.equal(setLocalAttempts, 1);
    assert.deepEqual(sent, []);
    assert.deepEqual(errors, []);
});

test("RTC signaling drops buffered ICE from stale pre-offer sessions", async () => {
    const {RTCPeer, connections} = createHarness();
    const peer = new RTCPeer({send() {}}, false, "peer-a", "nostr", "room", {});

    peer.onServerMessage({sessionId: "stale-session", ice: {candidate: "stale-candidate"}});
    peer.onServerMessage({sessionId: "remote-session", sdp: {type: "offer", sdp: "offer-sdp"}});
    await flushPromises();

    assert.equal(connections[0].remoteDescriptions.length, 1);
    assert.equal(connections[0].iceCandidates.length, 0);
});

test("RTC signaling drops candidates with ICE ufrags outside the active remote description", async () => {
    const {RTCPeer, connections} = createHarness();
    const peer = new RTCPeer({send() {}}, false, "peer-a", "nostr", "room", {});

    peer.onServerMessage({
        sessionId: "remote-session",
        sdp: {type: "offer", sdp: "v=0\r\na=ice-ufrag:current\r\n"}
    });
    await flushPromises();

    peer.onServerMessage({
        sessionId: "remote-session",
        ice: {candidate: "candidate", usernameFragment: "stale"}
    });
    peer.onServerMessage({
        sessionId: "remote-session",
        ice: {candidate: "candidate", usernameFragment: "current"}
    });
    await flushPromises();

    assert.equal(connections[0].iceCandidates.length, 1);
    assert.equal(connections[0].iceCandidates[0].usernameFragment, "current");
});

test("RTC signaling does not remove peers on transient disconnected state", () => {
    const {RTCPeer, connections, fired, warnings} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "nostr", "room", {});

    connections[0].connectionState = "disconnected";
    peer._onConnectionStateChange();

    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
    assert.equal(warnings.length, 1);
});

test("channel open tolerates missing SDP fingerprints", async () => {
    const {RTCPeer, connections, errors, fired} = createHarness();

    new RTCPeer({send() {}}, true, "peer-a", "nostr", "room", {});
    await flushPromises();

    const channel = connections[0].dataChannels[0];
    channel.readyState = "open";
    channel.onopen({target: channel});

    assert.deepEqual(errors, []);
    assert.equal(fired.at(-1).type, "peer-connected");
    assert.equal(fired.at(-1).detail.peerId, "peer-a");
    assert.equal(fired.at(-1).detail.connectionHash, "");
});

test("caller reconnects a closed RTC data channel with a fresh peer connection", async () => {
    const {RTCPeer, connections} = createHarness();
    const sent = [];

    new RTCPeer({send: message => sent.push(message)}, true, "peer-a", "nostr", "room", {});
    await flushPromises();

    const firstConnection = connections[0];
    const firstChannel = firstConnection.dataChannels[0];
    firstConnection.signalingState = "stable";
    firstConnection.localDescription = {sdp: "a=fingerprint:local\r\n"};
    firstConnection.remoteDescription = {sdp: "a=fingerprint:remote\r\n"};
    firstChannel.readyState = "open";
    firstChannel.onopen({target: firstChannel});

    firstChannel.close();
    await flushPromises();

    assert.equal(connections.length, 2);
    assert.equal(firstConnection.signalingState, "closed");
    assert.equal(connections[1].dataChannels.length, 1);
    assert.equal(sent.at(-1).sdp.type, "offer");
    assert.equal(sent.at(-1).sessionId, "session-2");
});

test("caller refreshes a stale negotiated connection before creating a new offer", async () => {
    const {RTCPeer, connections} = createHarness();
    const sent = [];
    const peer = new RTCPeer({send: message => sent.push(message)}, true, "peer-a", "fips", "room", {});
    await flushPromises();

    const firstConnection = connections[0];
    firstConnection.signalingState = "stable";
    firstConnection.localDescription = {sdp: "a=fingerprint:local\r\n"};
    firstConnection.remoteDescription = {sdp: "a=fingerprint:remote\r\n"};
    peer._channel = null;

    peer.refresh();
    await flushPromises();

    assert.equal(firstConnection.signalingState, "closed");
    assert.equal(connections.length, 2);
    assert.equal(connections[1].dataChannels.length, 1);
    assert.equal(sent.at(-1).sdp.type, "offer");
    assert.equal(sent.at(-1).sessionId, "session-2");
});

test("file transfer route selection resolves a Nostr pubkey alias to the visible RTC peer", async () => {
    const {PeersManager} = createHarness();
    const requests = [];
    const manager = new PeersManager({send() {}});
    const pubkey = "a".repeat(64);

    manager.peers["visible-peer"] = {
        requestFileTransfer: async (files, transfer) => requests.push({files, transfer})
    };
    manager._rememberPeerAliases("visible-peer", {
        id: "visible-peer",
        nostrIdentity: {pubkey}
    });

    await manager._onFilesSelected({
        to: pubkey,
        files: [{name: "note.txt", type: "text/plain"}],
        transport: {id: "webrtc", label: "WEB-RTC"}
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].files[0].name, "note.txt");
    assert.equal(requests[0].transfer.id, "webrtc");
});

test("peer-left removes a room type even when the websocket remains connected", () => {
    const {PeersManager, fired} = createHarness();
    const manager = new PeersManager({send() {}});

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _roomIds: {ip: "127.0.0.1", fips: "meshdrop-fips"},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
            fired.push({type: "room-type-removed", detail: {peerId: "peer-a", roomType}});
        }
    };

    manager._onPeerLeft({
        peerId: "peer-a",
        roomType: "ip",
        disconnect: false
    });

    assert.deepEqual(manager.peers["peer-a"]._roomIds, {fips: "meshdrop-fips"});
    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
});

test("leaving a room locally removes that room type from visible peers", () => {
    const {PeersManager, fired} = createHarness();
    const manager = new PeersManager({send() {}});

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _roomIds: {ip: "127.0.0.1", pollen: "meshdrop-pollen"},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
            fired.push({type: "room-type-removed", detail: {peerId: "peer-a", roomType}});
        }
    };

    manager._disconnectOrRemoveRoomTypeByRoomType("ip");

    assert.deepEqual(manager.peers["peer-a"]._roomIds, {pollen: "meshdrop-pollen"});
    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
});

test("disabled local discovery ignores late IP peer announcements", () => {
    const {PeersManager, connections, context} = createHarness();
    context.meshdropLocalDiscovery = {isEnabled: () => false};
    const manager = new PeersManager({send() {}});
    manager._onWsConfig({rtcConfig: {}, wsFallback: false});

    manager._onPeerJoined({
        peer: {id: "peer-a", rtcSupported: true},
        roomType: "ip",
        roomId: "127.0.0.1"
    });

    assert.deepEqual(Object.keys(manager.peers), []);
    assert.equal(connections.length, 0);
});

test("accepted Pollen storage responses do not stream files over RTC", () => {
    const {RTCPeer} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "ip", "127.0.0.1", {});
    let streamed = false;
    peer.sendFiles = () => {
        streamed = true;
    };

    peer._onFileTransferRequestResponded({accepted: true, pollen: true});

    assert.equal(streamed, false);
});

test("peer lists honor explicit caller assignment", () => {
    const {PeersManager} = createHarness();
    const manager = new PeersManager({send() {}});
    manager._onWsConfig({rtcConfig: {}, wsFallback: false});

    manager._onPeers({
        roomType: "fips",
        roomId: "meshdrop-fips",
        peers: [{id: "peer-a", rtcSupported: true, isCaller: false}]
    });

    assert.equal(manager.peers["peer-a"]._isCaller, false);
});
