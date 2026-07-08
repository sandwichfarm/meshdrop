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
        constructor(config = {}) {
            this.config = config;
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

function instanceIceBridgeDescriptor(routeType, roomId, url) {
    return {
        routeType,
        rooms: [roomId],
        iceBridge: {
            supported: true,
            source: "instance",
            bridgeRole: `${routeType}-instance-ice-bridge`,
            rtcConfig: {
                iceServers: [{urls: url}]
            },
            topologyEvidence: {
                overlay: routeType,
                instance: `${routeType}-instance`
            }
        }
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

test("RTC route status exposes ICE failure and triggers route fallback", async () => {
    const {RTCPeer, connections, fired} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "nostr", "nostr-room", {});
    await flushPromises();

    connections[0].iceConnectionState = "failed";
    peer._onIceConnectionStateChange();

    assert.equal(
        fired.some(event => event.type === "peer-route-failed"
            && event.detail.peerId === "peer-a"
            && event.detail.reason === "ice-failed"),
        true
    );
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "nostr"
            && event.detail.state === "ice-failed"),
        true
    );
});

test("RTC route timeout triggers fallback instead of waiting for a fresh announcement", async () => {
    const {RTCPeer, fired} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "fips", "fips-room", {});
    await flushPromises();

    peer._clearRouteAttemptTimeout();
    peer._onRouteAttemptTimeout("test-timeout");

    assert.equal(
        fired.some(event => event.type === "peer-route-failed"
            && event.detail.peerId === "peer-a"
            && event.detail.reason === "route-timeout"),
        true
    );
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "fips"
            && event.detail.state === "timeout"
            && event.detail.timeoutMs === 15000),
        true
    );
});

test("RTC signaling rejects sessionless answers", async () => {
    const {RTCPeer, connections, errors} = createHarness();
    const peer = new RTCPeer({send() {}}, true, "peer-a", "nostr", "room", {});
    await flushPromises();

    peer.onServerMessage({sdp: {type: "answer", sdp: "sessionless-answer"}});
    await flushPromises();

    assert.equal(connections[0].remoteDescriptions.length, 0);
    assert.equal(connections[0].remoteDescription, null);
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

test("caller recovers from stale local-offer m-line errors with a fresh connection", async () => {
    const {RTCPeer, connections, errors} = createHarness();
    const sent = [];
    const peer = new RTCPeer({send: message => sent.push(message)}, true, "peer-a", "fips", "room", {});

    connections[0].setLocalDescription = description => {
        if (description.type === "offer") {
            const error = new Error(
                "Failed to set local offer sdp: The order of m-lines in subsequent offer doesn't match order"
            );
            error.name = "InvalidAccessError";
            return Promise.reject(error);
        }
        return Promise.resolve();
    };
    await flushPromises();
    await flushPromises();

    assert.equal(connections[0].signalingState, "closed");
    assert.equal(connections.length, 2);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].sdp.type, "offer");
    assert.equal(sent[0].sessionId, "session-2");
    assert.deepEqual(errors, []);

    connections[1].setLocalDescription = () => {
        const error = new Error("Failed to set local offer sdp: The order of m-lines still doesn't match order");
        error.name = "InvalidAccessError";
        return Promise.reject(error);
    };
    peer._onDescription({type: "offer", sdp: "another-offer"});
    await flushPromises();

    assert.equal(errors.length, 1);
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

test("PeersManager keeps Nostr identity on local transport peers for UI grouping", () => {
    const {PeersManager} = createHarness();
    const manager = new PeersManager({send() {}});
    const pubkey = "b".repeat(64);

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        isCaller: false,
        roomType: "ip",
        roomId: "local-room",
        peer: {
            id: "local-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey},
            name: {displayName: "NADAR2", deviceName: "Mac Macintosh"}
        }
    });

    assert.equal(manager.peers["local-peer"].nostrIdentity.pubkey, pubkey);
    assert.equal(manager.peers["local-peer"].name.deviceName, "Mac Macintosh");
    assert.equal(manager._resolvePeerId(pubkey), "local-peer");
    assert.equal(manager._resolvePeerId(pubkey.toUpperCase()), "local-peer");
});

test("PeersManager refresh merges Nostr identity into an existing transport peer", () => {
    const {PeersManager} = createHarness();
    const manager = new PeersManager({send() {}});
    const pubkey = "c".repeat(64);

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        isCaller: false,
        roomType: "ip",
        roomId: "local-room",
        peer: {id: "same-peer", rtcSupported: true}
    });
    manager._onPeerJoined({
        isCaller: false,
        roomType: "pollen",
        roomId: "pollen-room",
        peer: {
            id: "same-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey},
            name: {displayName: "NADAR2", deviceName: "Mac Macintosh"}
        }
    });

    assert.equal(manager.peers["same-peer"]._roomIds.ip, "local-room");
    assert.equal(manager.peers["same-peer"]._roomIds.pollen, "pollen-room");
    assert.equal(manager.peers["same-peer"].nostrIdentity.pubkey, pubkey);
    assert.equal(manager._resolvePeerId(pubkey), "same-peer");
});

test("PeersManager merges same-npub routes and signals the route-specific target id", async () => {
    const {PeersManager, connections} = createHarness();
    const manager = new PeersManager({send() {}});
    const sent = [];
    const pubkey = "d".repeat(64);
    const nostrTransport = {send: message => sent.push(message)};

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        peer: {
            id: "fips-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey},
            name: {displayName: "NADAR2", deviceName: "Mac Macintosh"}
        }
    });
    manager._onPeerJoined({
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room",
        transport: nostrTransport,
        peer: {
            id: pubkey,
            rtcSupported: true,
            nostrIdentity: {pubkey},
            name: {displayName: "NADAR2", deviceName: "Nostr peer"}
        }
    });
    await flushPromises();

    assert.deepEqual(Object.keys(manager.peers), ["fips-peer"]);
    assert.equal(manager.peers["fips-peer"]._roomIds.fips, "fips-room");
    assert.equal(manager.peers["fips-peer"]._roomIds.nostr, "nostr-room");
    assert.equal(manager.peers["fips-peer"]._peerIdsByRoomType.fips, "fips-peer");
    assert.equal(manager.peers["fips-peer"]._peerIdsByRoomType.nostr, pubkey);
    assert.equal(manager._resolvePeerId(pubkey), "fips-peer");
    assert.equal(connections.length, 1);
    assert.equal(sent.at(-1).to, pubkey);
    assert.equal(sent.at(-1).roomType, "nostr");
});

test("PeersManager merges private route metadata peer pubkey without server auth identity", () => {
    const {PeersManager, context} = createHarness();
    const manager = new PeersManager({send() {}});
    const pubkey = "1".repeat(64);
    context.meshdropFipsDiscovery = {
        routeMetadataForRoom(roomId) {
            return roomId === "fips-private-room"
                ? {
                    ...instanceIceBridgeDescriptor("fips", roomId, "turn:fips-instance.test:3478?transport=tcp"),
                    peerPubkey: pubkey
                }
                : null;
        }
    };

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room",
        peer: {
            id: pubkey,
            rtcSupported: true,
            routeCapabilities: ["fips"],
            nostrIdentity: {pubkey}
        }
    });
    manager._onPeerJoined({
        isCaller: false,
        roomType: "fips",
        roomId: "fips-private-room",
        peer: {
            id: "meshdrop-fed-random",
            rtcSupported: true
        }
    });

    assert.deepEqual(Object.keys(manager.peers), [pubkey]);
    assert.equal(manager.peers[pubkey]._roomIds.nostr, "nostr-room");
    assert.equal(manager.peers[pubkey]._roomIds.fips, "fips-private-room");
    assert.equal(manager.peers[pubkey]._peerIdsByRoomType.fips, "meshdrop-fed-random");
    assert.equal(manager.peers[pubkey]._routeMetadataByRoomType.fips.peerPubkey, pubkey);
    assert.equal(manager._resolvePeerId("meshdrop-fed-random"), pubkey);
});

test("PeersManager collapses an existing overlay bubble when its Nostr identity arrives later", () => {
    const {PeersManager} = createHarness();
    const manager = new PeersManager({send() {}});
    const pubkey = "2".repeat(64);

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room",
        peer: {
            id: pubkey,
            rtcSupported: true,
            nostrIdentity: {pubkey}
        }
    });
    manager._onPeerJoined({
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        peer: {
            id: "meshdrop-fed-random",
            rtcSupported: true
        }
    });

    assert.equal(Object.keys(manager.peers).length, 2);

    manager._onPeerJoined({
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        peer: {
            id: "meshdrop-fed-random",
            rtcSupported: true,
            nostrIdentity: {pubkey},
            name: {displayName: "NADAR2", deviceName: "Mac Macintosh"}
        }
    });

    const peerIds = Object.keys(manager.peers);
    assert.equal(peerIds.length, 1);
    assert.equal(manager.peers[peerIds[0]]._roomIds.nostr, "nostr-room");
    assert.equal(manager.peers[peerIds[0]]._roomIds.fips, "fips-room");
    assert.equal(manager.peers[peerIds[0]].nostrIdentity.pubkey, pubkey);
    assert.equal(manager._resolvePeerId(pubkey), peerIds[0]);
    assert.equal(manager._resolvePeerId("meshdrop-fed-random"), peerIds[0]);
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

test("PeersManager falls back from direct Nostr to FIPS then Pollen on RTC failure", () => {
    const {PeersManager, fired} = createHarness();
    const manager = new PeersManager({send() {}});
    const switches = [];
    const fipsTransport = {send() {}};
    const pollenTransport = {send() {}};

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _intentionalDisconnect: false,
        _isCaller: true,
        _roomIds: {nostr: "nostr-room", fips: "fips-room", pollen: "pollen-room"},
        _transportsByRoomType: {fips: fipsTransport, pollen: pollenTransport},
        _peerIdsByRoomType: {nostr: "nostr-peer", fips: "fips-peer", pollen: "pollen-peer"},
        _isCallerByRoomType: {fips: false, pollen: true},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
        },
        switchSignalingRoute(isCaller, roomType, roomId, transport) {
            switches.push({isCaller, roomType, roomId, transport});
        }
    };

    manager._onPeerRouteFailed({peerId: "peer-a", reason: "test-failure"});

    assert.equal(manager.peers["peer-a"]._roomIds.nostr, undefined);
    assert.equal(fired.some(event => event.type === "nostr-route-request-needed"), false);
    assert.deepEqual(switches, [{
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport
    }]);
    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "nostr"
            && event.detail.state === "failed"),
        true
    );
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "fips"
            && event.detail.routePeerId === "fips-peer"
            && event.detail.state === "selected"),
        true
    );
});

test("PeersManager requests private route details only after direct Nostr route failure", () => {
    const {PeersManager, fired} = createHarness();
    const manager = new PeersManager({send() {}});
    const pubkey = "e".repeat(64);

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _intentionalDisconnect: false,
        _isCaller: true,
        routeCapabilities: ["fips", "pollen"],
        nostrIdentity: {pubkey},
        _roomIds: {nostr: "nostr-room"},
        _transportsByRoomType: {},
        _peerIdsByRoomType: {nostr: pubkey},
        _isCallerByRoomType: {},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
            delete this._peerIdsByRoomType[roomType];
        },
        _routePeerId(roomType) {
            return this._peerIdsByRoomType?.[roomType] || this._peerId;
        }
    };

    manager._onPeerRouteFailed({peerId: "peer-a", reason: "route-timeout"});

    assert.equal(manager.peers["peer-a"]._roomIds.nostr, undefined);
    assert.equal(manager.peers["peer-a"]._pendingPrivateRouteRequests.fips, true);
    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
    assert.deepEqual(
        fired
            .filter(event => event.type === "nostr-route-request-needed")
            .map(event => ({
                peerId: event.detail.peerId,
                recipientPubkey: event.detail.recipientPubkey,
                routeType: event.detail.routeType,
                failedRoute: event.detail.failedRoute
            })),
        [{
            peerId: "peer-a",
            recipientPubkey: pubkey,
            routeType: "fips",
            failedRoute: "nostr"
        }]
    );
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "fips"
            && event.detail.state === "requested"),
        true
    );
});

test("PeersManager selects route candidate returned after encrypted descriptor exchange", () => {
    const {PeersManager} = createHarness();
    const manager = new PeersManager({send() {}});
    const pubkey = "e".repeat(64);
    const switches = [];
    const fipsTransport = {send() {}};

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager.peers["peer-a"] = {
        rtcSupported: true,
        _intentionalDisconnect: false,
        _isCaller: true,
        routeCapabilities: ["fips"],
        nostrIdentity: {pubkey},
        _roomIds: {},
        _transportsByRoomType: {},
        _peerIdsByRoomType: {},
        _pendingPrivateRouteRequests: {fips: true},
        _isCallerByRoomType: {},
        _isConnected: () => false,
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _updateRoomIds(roomType, roomId, routePeerId) {
            this._roomIds[roomType] = roomId;
            this._peerIdsByRoomType[roomType] = routePeerId;
        },
        _evaluateAutoAccept() {},
        _routePeerId(roomType) {
            return this._peerIdsByRoomType?.[roomType] || "peer-a";
        },
        switchSignalingRoute(isCaller, roomType, roomId, transport, routePeerId) {
            switches.push({isCaller, roomType, roomId, transport, routePeerId});
        }
    };

    manager._onPeerJoined({
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport,
        peer: {
            id: "fips-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey}
        }
    });

    assert.deepEqual(switches, [{
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport,
        routePeerId: "fips-peer"
    }]);
    assert.equal(manager.peers["peer-a"]._pendingPrivateRouteRequests.fips, undefined);
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

test("disabled clearnet routes ignore direct Nostr peer announcements", () => {
    const {PeersManager, connections, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    const manager = new PeersManager({send() {}});
    manager._onWsConfig({rtcConfig: {}, wsFallback: false});

    manager._onPeerJoined({
        peer: {id: "peer-a", rtcSupported: true},
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });

    assert.deepEqual(Object.keys(manager.peers), []);
    assert.equal(connections.length, 0);
});

test("disabled clearnet requests private FIPS signaling but blocks WebRTC without ICE bridge", () => {
    const {PeersManager, connections, fired, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    const manager = new PeersManager({send() {}});
    const pubkey = "f".repeat(64);
    const fipsTransport = {send() {}};

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        peer: {
            id: pubkey,
            rtcSupported: true,
            routeCapabilities: ["fips"],
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });

    assert.equal(connections.length, 0);
    assert.deepEqual(Object.keys(manager.peers[pubkey]._roomIds), []);
    assert.equal(manager.peers[pubkey]._pendingPrivateRouteRequests.fips, true);
    assert.deepEqual(
        fired
            .filter(event => event.type === "peer-route-status")
            .map(event => ({
                peerId: event.detail.peerId,
                route: event.detail.route,
                state: event.detail.state,
                reason: event.detail.reason
            })),
        [
            {peerId: pubkey, route: "nostr", state: "disabled", reason: "route-policy"},
            {peerId: pubkey, route: "fips", state: "requested", reason: "descriptor-request"}
        ]
    );
    assert.deepEqual(
        fired
            .filter(event => event.type === "nostr-route-request-needed")
            .map(event => ({
                peerId: event.detail.peerId,
                recipientPubkey: event.detail.recipientPubkey,
                routeType: event.detail.routeType,
                failedRoute: event.detail.failedRoute,
                reason: event.detail.reason
            })),
        [{
            peerId: pubkey,
            recipientPubkey: pubkey,
            routeType: "fips",
            failedRoute: "",
            reason: "clearnet-disabled"
        }]
    );

    manager._onPeerJoined({
        peer: {
            id: "fips-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport
    });

    assert.equal(connections.length, 0);
    assert.equal(manager.peers[pubkey]._roomIds.fips, undefined);
    assert.equal(manager.peers[pubkey]._peerIdsByRoomType.fips, undefined);
    assert.equal(manager.peers[pubkey]._pendingPrivateRouteRequests.fips, true);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === pubkey
            && event.detail.route === "fips"
            && event.detail.state === "disabled"
            && event.detail.reason === "overlay-bridge-unavailable"),
        true
    );
});

test("display-name restore skips pending private route placeholders", () => {
    const {PeersManager, connections, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    const manager = new PeersManager({send() {}});
    const pubkey = "d".repeat(64);

    manager._onWsConfig({rtcConfig: {}, wsFallback: false});
    manager._onPeerJoined({
        peer: {
            id: pubkey,
            rtcSupported: true,
            routeCapabilities: ["fips"],
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });

    assert.equal(connections.length, 0);
    assert.equal(manager.peers[pubkey]._pendingPrivateRouteRequests.fips, true);
    assert.doesNotThrow(() => manager._notifyPeersDisplayNameChanged("NADAR2"));
});

test("disabled clearnet uses bridge-constrained RTC config when FIPS global route bridge config is available", () => {
    const {PeersManager, connections, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    const manager = new PeersManager({send() {}});
    const pubkey = "c".repeat(64);
    const fipsTransport = {send() {}};

    manager._onConfig({
        capabilities: {
            transports: {
                fips: {
                    relayIce: {
                        supported: true,
                        rtcConfig: {
                            iceServers: [{urls: "turn:fips-relay.test"}]
                        }
                    }
                }
            }
        }
    });
    manager._onWsConfig({rtcConfig: {iceServers: [{urls: "stun:default.example:19302"}]}, wsFallback: false});
    manager._onPeerJoined({
        peer: {
            id: pubkey,
            rtcSupported: true,
            routeCapabilities: ["fips"],
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });
    manager._onPeerJoined({
        peer: {
            id: "fips-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport
    });

    assert.equal(connections.length, 1);
    assert.equal(connections[0].config.iceTransportPolicy, "relay");
    assert.deepEqual(connections[0].config.iceServers, [{urls: "turn:fips-relay.test"}]);
});

test("disabled clearnet uses trusted FIPS descriptor ICE bridge without global TURN env", () => {
    const {PeersManager, connections, fired, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    context.meshdropFipsDiscovery = {
        routeMetadataForRoom(roomId) {
            return roomId === "fips-room"
                ? instanceIceBridgeDescriptor("fips", roomId, "turn:fips-instance.test:3478?transport=tcp")
                : null;
        }
    };
    const manager = new PeersManager({send() {}});
    const pubkey = "d".repeat(64);
    const fipsTransport = {send() {}};

    manager._onWsConfig({rtcConfig: {iceServers: [{urls: "stun:default.example:19302"}]}, wsFallback: false});
    manager._onPeerJoined({
        peer: {
            id: pubkey,
            rtcSupported: true,
            routeCapabilities: ["fips"],
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });
    manager._onPeerJoined({
        peer: {
            id: "fips-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport
    });

    assert.equal(connections.length, 1);
    assert.equal(connections[0].config.iceTransportPolicy, "relay");
    assert.deepEqual(connections[0].config.iceServers, [{urls: "turn:fips-instance.test:3478?transport=tcp"}]);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.route === "fips"
            && event.detail.reason === "instance-ice-bridge"
            && event.detail.routeMetadata?.iceBridge?.source === "instance"),
        true
    );
});

test("disabled clearnet uses trusted Pollen descriptor ICE bridge without global TURN env", () => {
    const {PeersManager, connections, fired, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    context.meshdropPollenTransfer = {
        routeMetadataForRoom(roomId) {
            return roomId === "pollen-room"
                ? instanceIceBridgeDescriptor("pollen", roomId, "turn:pollen-instance.test:3478?transport=tcp")
                : null;
        }
    };
    const manager = new PeersManager({send() {}});
    const pubkey = "a".repeat(64);
    const pollenTransport = {send() {}};

    manager._onWsConfig({rtcConfig: {iceServers: [{urls: "stun:default.example:19302"}]}, wsFallback: false});
    manager._onPeerJoined({
        peer: {
            id: pubkey,
            rtcSupported: true,
            routeCapabilities: ["pollen"],
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });
    manager._onPeerJoined({
        peer: {
            id: "pollen-peer",
            rtcSupported: true,
            nostrIdentity: {pubkey}
        },
        isCaller: true,
        roomType: "pollen",
        roomId: "pollen-room",
        transport: pollenTransport
    });

    assert.equal(connections.length, 1);
    assert.equal(connections[0].config.iceTransportPolicy, "relay");
    assert.deepEqual(connections[0].config.iceServers, [{urls: "turn:pollen-instance.test:3478?transport=tcp"}]);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.route === "pollen"
            && event.detail.reason === "instance-ice-bridge"),
        true
    );
});

test("clearnet preference allows Nostr routes when instance sharing is disabled", () => {
    const {PeersManager, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => false};
    context.ClearnetRouteProtocol = {allowsRoomType: () => true};
    const manager = new PeersManager({send() {}});
    manager._onWsConfig({rtcConfig: {}, wsFallback: false});

    manager._onPeerJoined({
        peer: {id: "peer-a", rtcSupported: true},
        isCaller: true,
        roomType: "nostr",
        roomId: "nostr-room"
    });

    assert.deepEqual(Object.keys(manager.peers), ["peer-a"]);
    assert.equal(manager.peers["peer-a"]._roomIds.nostr, "nostr-room");
});

test("backend-free config refuses peer-advertised FIPS as a selectable signaling route", () => {
    const {PeersManager, context, connections, fired} = createHarness();
    context.RuntimeCapabilities = {
        transportSupported(config, transport, fallback = false) {
            const capability = config?.capabilities?.transports?.[transport];
            if (typeof capability?.supported === "boolean") return capability.supported;

            return fallback;
        }
    };
    const manager = new PeersManager({send() {}});
    manager._onConfig({
        capabilities: {
            runtime: {
                target: "spa",
                platform: "browser",
                hasBackend: false
            },
            transports: {
                webrtc: {supported: true},
                nostr: {supported: true},
                fips: {supported: false, unavailableReason: "requires-instance-native-route"}
            }
        }
    });
    manager._onWsConfig({rtcConfig: {}, wsFallback: false});

    manager._onPeerJoined({
        peer: {
            id: "fips-peer",
            rtcSupported: true,
            routeCapabilities: ["fips"]
        },
        isCaller: true,
        roomType: "fips",
        roomId: "fips-room"
    });

    assert.deepEqual(Object.keys(manager.peers), []);
    assert.equal(connections.length, 0);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "fips-peer"
            && event.detail.route === "fips"
            && event.detail.state === "disabled"
            && event.detail.reason === "requires-instance-native-route"),
        true
    );
});

test("disabling clearnet refuses FIPS fallback when ICE bridge is unavailable", () => {
    const {PeersManager, fired, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    const manager = new PeersManager({send() {}});
    const switches = [];
    const fipsTransport = {send() {}};

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _intentionalDisconnect: false,
        _isCaller: true,
        _roomIds: {nostr: "nostr-room", fips: "fips-room", pollen: "pollen-room"},
        _transportsByRoomType: {fips: fipsTransport},
        _peerIdsByRoomType: {nostr: "nostr-peer", fips: "fips-peer", pollen: "pollen-peer"},
        _isCallerByRoomType: {fips: false},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
        },
        switchSignalingRoute(isCaller, roomType, roomId, transport, routePeerId) {
            switches.push({isCaller, roomType, roomId, transport, routePeerId});
        }
    };

    manager._onClearnetRoutesChanged({enabled: false, roomTypes: ["nostr"]});

    assert.equal(manager.peers["peer-a"]._roomIds.nostr, undefined);
    assert.equal(manager.peers["peer-a"]._roomIds.fips, undefined);
    assert.deepEqual(switches, []);
    assert.equal(fired.some(event => event.type === "peer-disconnected"), true);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "fips"
            && event.detail.state === "disabled"
            && event.detail.reason === "overlay-bridge-unavailable"),
        true
    );
});

test("disabling clearnet allows FIPS fallback when global bridge config is available", () => {
    const {PeersManager, fired, context} = createHarness();
    context.LocalDiscoveryProtocol = {allowsRoomType: () => true};
    context.ClearnetRouteProtocol = {allowsRoomType: roomType => roomType !== "nostr"};
    const manager = new PeersManager({send() {}});
    const switches = [];
    const fipsTransport = {send() {}};
    manager._onConfig({
        capabilities: {
            transports: {
                fips: {
                    relayIce: {
                        supported: true,
                        rtcConfig: {
                            iceServers: [{urls: "turn:fips-relay.test"}]
                        }
                    }
                }
            }
        }
    });

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _intentionalDisconnect: false,
        _isCaller: true,
        _roomIds: {nostr: "nostr-room", fips: "fips-room"},
        _transportsByRoomType: {fips: fipsTransport},
        _peerIdsByRoomType: {nostr: "nostr-peer", fips: "fips-peer"},
        _isCallerByRoomType: {fips: false},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
        },
        switchSignalingRoute(isCaller, roomType, roomId, transport, routePeerId) {
            switches.push({isCaller, roomType, roomId, transport, routePeerId});
        }
    };

    manager._onClearnetRoutesChanged({enabled: false, roomTypes: ["nostr"]});

    assert.deepEqual(switches, [{
        isCaller: false,
        roomType: "fips",
        roomId: "fips-room",
        transport: fipsTransport,
        routePeerId: "fips-peer"
    }]);
    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
    assert.equal(
        fired.some(event => event.type === "peer-route-status"
            && event.detail.peerId === "peer-a"
            && event.detail.route === "fips"
            && event.detail.state === "selected"),
        true
    );
});

test("disabling clearnet leaves same-instance route active", () => {
    const {PeersManager, fired} = createHarness();
    const manager = new PeersManager({send() {}});

    manager.peers["peer-a"] = {
        rtcSupported: true,
        _roomIds: {ip: "127.0.0.1", nostr: "nostr-room"},
        _getRoomTypes() {
            return Object.keys(this._roomIds);
        },
        _removeRoomType(roomType) {
            delete this._roomIds[roomType];
        }
    };

    manager._onClearnetRoutesChanged({enabled: false, roomTypes: ["nostr"]});

    assert.deepEqual(manager.peers["peer-a"]._roomIds, {ip: "127.0.0.1"});
    assert.equal(fired.some(event => event.type === "peer-disconnected"), false);
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
