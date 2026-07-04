import test from "node:test";
import assert from "node:assert/strict";
import {finalizeEvent, generateSecretKey, getPublicKey, nip19, utils} from "nostr-tools";
import {WebSocketServer} from "ws";

import PairDropWsServer from "../server/ws-server.js";
import MeshFederation, {createFederationConfig} from "../server/federation.js";

function createServerHarness() {
    const sent = [];
    const forwarded = [];
    const federation = {
        localPeerJoined(roomType, roomId, peerInfo) {
            forwarded.push({type: "joined", roomType, roomId, peerInfo});
        },
        localPeerLeft(roomType, roomId, peerId) {
            forwarded.push({type: "left", roomType, roomId, peerId});
        },
        sendSignal(target, sender, message) {
            forwarded.push({type: "signal", target, sender, message});
        }
    };
    const server = Object.create(PairDropWsServer.prototype);
    server._rooms = {};
    server._conf = {federationClient: federation};
    server._send = (peer, message) => sent.push({peer: peer.id, message});
    return {server, sent, forwarded};
}

function createPeer(id) {
    return {
        id,
        rtcSupported: true,
        getInfo() {
            return {id, rtcSupported: true};
        }
    };
}

function roomKey(roomType, roomId) {
    return `${roomType}\n${roomId}`;
}

async function waitFor(predicate, timeoutMs = 1000) {
    const started = Date.now();
    while (!predicate()) {
        if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for condition");
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

test("federation events create and remove remote peers without echoing them back", () => {
    const {server, sent, forwarded} = createServerHarness();
    const localPeer = createPeer("11111111-1111-4111-8111-111111111111");
    const remotePeer = {
        id: "22222222-2222-4222-8222-222222222222",
        rtcSupported: true,
        name: {displayName: "Remote"}
    };

    server._joinRoom(localPeer, "pollen", "meshdrop-pollen");
    sent.length = 0;
    forwarded.length = 0;

    server._onFederationPeerJoined({
        serverId: "remote-server",
        transport: "pollen",
        roomType: "pollen",
        roomId: "meshdrop-pollen",
        peer: remotePeer
    });

    assert.equal(server._rooms[roomKey("pollen", "meshdrop-pollen")][remotePeer.id].isRemoteFederation, true);
    assert.deepEqual(sent, [{
        peer: localPeer.id,
        message: {
            type: "peer-joined",
            peer: remotePeer,
            roomType: "pollen",
            roomId: "meshdrop-pollen",
            isCaller: false
        }
    }]);
    assert.deepEqual(forwarded, []);

    server._onFederationPeerLeft({
        peerId: remotePeer.id,
        roomType: "pollen",
        roomId: "meshdrop-pollen",
        disconnect: true
    });

    assert.equal(server._rooms[roomKey("pollen", "meshdrop-pollen")][remotePeer.id], undefined);
    assert.equal(sent.at(-1).message.type, "peer-left");
});

test("FIPS and Pollen rooms with the same npub network id stay separate", () => {
    const {server, sent} = createServerHarness();
    const fipsPeer = createPeer("11111111-1111-4111-8111-111111111111");
    const pollenPeer = createPeer("22222222-2222-4222-8222-222222222222");
    const networkRoom = "npub-network:shared";

    server._joinRoom(fipsPeer, "fips", networkRoom);
    server._joinRoom(pollenPeer, "pollen", networkRoom);

    assert.equal(server._rooms[roomKey("fips", networkRoom)][fipsPeer.id], fipsPeer);
    assert.equal(server._rooms[roomKey("pollen", networkRoom)][pollenPeer.id], pollenPeer);
    assert.equal(sent.some(entry => entry.message.roomType === "pollen" && entry.message.peers.length), false);
});

test("signals addressed to remote federation peers relay to their MeshDrop server", () => {
    const {server, forwarded} = createServerHarness();
    const localPeer = createPeer("11111111-1111-4111-8111-111111111111");
    const remotePeer = {
        id: "22222222-2222-4222-8222-222222222222",
        rtcSupported: true,
        name: {displayName: "Remote"}
    };

    server._joinRoom(localPeer, "fips", "meshdrop-fips");
    server._onFederationPeerJoined({
        serverId: "remote-server",
        transport: "fips",
        roomType: "fips",
        roomId: "meshdrop-fips",
        peer: remotePeer
    });

    server._signalAndRelay(localPeer, {
        type: "signal",
        to: remotePeer.id,
        roomType: "fips",
        roomId: "meshdrop-fips",
        sdp: {type: "offer", sdp: "v=0"}
    });

    assert.equal(forwarded.at(-1).type, "signal");
    assert.equal(forwarded.at(-1).target.serverId, "remote-server");
    assert.equal(forwarded.at(-1).message.to, remotePeer.id);
});

test("joining after a remote federation peer uses deterministic caller assignment", () => {
    const {server, sent} = createServerHarness();
    const localPeer = createPeer("11111111-1111-4111-8111-111111111111");
    const remotePeer = {
        id: "22222222-2222-4222-8222-222222222222",
        rtcSupported: true,
        name: {displayName: "Remote"}
    };

    server._onFederationPeerJoined({
        serverId: "remote-server",
        transport: "fips",
        roomType: "fips",
        roomId: "meshdrop-fips",
        peer: remotePeer
    });
    sent.length = 0;

    server._joinRoom(localPeer, "fips", "meshdrop-fips");

    const peersMessage = sent.find(entry => entry.peer === localPeer.id && entry.message.type === "peers")?.message;
    assert.equal(peersMessage.peers.length, 1);
    assert.equal(peersMessage.peers[0].id, remotePeer.id);
    assert.equal(peersMessage.peers[0].isCaller, false);
});

test("joining after a lower-id remote federation peer becomes the caller", () => {
    const {server, sent} = createServerHarness();
    const localPeer = createPeer("22222222-2222-4222-8222-222222222222");
    const remotePeer = {
        id: "11111111-1111-4111-8111-111111111111",
        rtcSupported: true,
        name: {displayName: "Remote"}
    };

    server._onFederationPeerJoined({
        serverId: "remote-server",
        transport: "fips",
        roomType: "fips",
        roomId: "meshdrop-fips",
        peer: remotePeer
    });
    sent.length = 0;

    server._joinRoom(localPeer, "fips", "meshdrop-fips");

    const peersMessage = sent.find(entry => entry.peer === localPeer.id && entry.message.type === "peers")?.message;
    assert.equal(peersMessage.peers.length, 1);
    assert.equal(peersMessage.peers[0].id, remotePeer.id);
    assert.equal(peersMessage.peers[0].isCaller, true);
});

test("incoming federation signal is delivered to local browser peer", () => {
    const {server, sent} = createServerHarness();
    const localPeer = createPeer("11111111-1111-4111-8111-111111111111");
    const remotePeer = {
        id: "22222222-2222-4222-8222-222222222222",
        rtcSupported: true,
        name: {displayName: "Remote"}
    };

    server._joinRoom(localPeer, "fips", "meshdrop-fips");
    server._onFederationPeerJoined({
        serverId: "remote-server",
        transport: "fips",
        roomType: "fips",
        roomId: "meshdrop-fips",
        peer: remotePeer
    });
    sent.length = 0;

    server._onFederationSignal({
        serverId: "remote-server",
        transport: "fips",
        roomType: "fips",
        roomId: "meshdrop-fips",
        to: localPeer.id,
        sender: remotePeer,
        sdp: {type: "answer", sdp: "v=0"}
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].peer, localPeer.id);
    assert.equal(sent[0].message.sender.id, remotePeer.id);
    assert.equal(sent[0].message.sdp.type, "answer");
});

test("federation config derives FIPS and Pollen discovery from npub contacts", () => {
    const localSecret = generateSecretKey();
    const peerSecret = generateSecretKey();
    const localPubkey = getPublicKey(localSecret);
    const peerPubkey = getPublicKey(peerSecret);
    const config = createFederationConfig({
        MESHDROP_FEDERATION: "true",
        MESHDROP_SERVER_ID: "local-server",
        NOSTR_RELAYS: "wss://relay.example",
        NOSTR_ROOM: "legacy-room",
        FIPS_ROOM: "fips-room",
        POLLEN_ROOM: "pollen-room",
        MESHDROP_NOSTR_SECRET_KEY: utils.bytesToHex(localSecret),
        MESHDROP_DISCOVERY_NPUBS: `${nip19.npubEncode(peerPubkey)},${peerPubkey}`,
        PLN_BIN: "/usr/local/bin/pln"
    });

    assert.equal(config.enabled, true);
    assert.equal(config.pollen.enabled, true);
    assert.equal(config.pollen.command, "/usr/local/bin/pln");
    assert.match(config.pollen.room, /^npub-network:[a-f0-9]{32}$/);
    assert.equal(config.fips.room, config.pollen.room);
    assert.notEqual(config.pollen.room, "pollen-room");
    assert.notEqual(config.fips.room, "fips-room");
    assert.deepEqual(config.nostr.relays, ["wss://relay.example"]);
    assert.equal(config.nostr.pubkey, localPubkey);
    assert.equal(config.nostr.networkId, config.pollen.room);
    assert.deepEqual(config.nostr.recipientPubkeys, [peerPubkey]);
    assert.equal(config.nostr.room, undefined);
});

test("federation subscribes to Pollen announcements addressed to the local npub", async () => {
    const localSecret = generateSecretKey();
    const localPubkey = getPublicKey(localSecret);
    const server = new WebSocketServer({host: "127.0.0.1", port: 0});
    const messages = [];
    server.on("connection", socket => {
        socket.on("message", message => messages.push(JSON.parse(message.toString("utf8"))));
    });
    await new Promise(resolve => server.once("listening", resolve));
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "true",
        MESHDROP_SERVER_ID: "local-server",
        MESHDROP_NOSTR_SECRET_KEY: utils.bytesToHex(localSecret),
        NOSTR_RELAYS: `ws://127.0.0.1:${server.address().port}`,
        POLLEN_TRANSFER: "false"
    }));

    try {
        federation._connectNostrRelays();
        await waitFor(() => messages.length > 0);
    }
    finally {
        federation.stop();
        await new Promise(resolve => server.close(resolve));
    }

    assert.equal(messages[0][0], "REQ");
    assert.deepEqual(messages[0][2], {kinds: [25051], "#p": [localPubkey]});
});

test("federation announces Pollen service to configured npub contacts", async () => {
    const localSecret = generateSecretKey();
    const peerSecret = generateSecretKey();
    const peerPubkey = getPublicKey(peerSecret);
    const sent = [];
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "true",
        MESHDROP_SERVER_ID: "local-server",
        MESHDROP_NOSTR_SECRET_KEY: utils.bytesToHex(localSecret),
        MESHDROP_DISCOVERY_NPUBS: nip19.npubEncode(peerPubkey)
    }));

    await federation._announcePollenNostr({
        readyState: 1,
        send: message => sent.push(JSON.parse(message))
    });

    assert.equal(sent.length, 1);
    const tags = sent[0][1].tags;
    assert(tags.some(tag => tag[0] === "p" && tag[1] === peerPubkey));
    assert(tags.some(tag => tag[0] === "network" && tag[1] === federation.config.nostr.networkId));
    assert.equal(tags.some(tag => tag[0] === "r"), false);
});

test("federation ignores Pollen Nostr announcements not addressed to the local npub", async () => {
    const localSecret = generateSecretKey();
    const peerSecret = generateSecretKey();
    const otherSecret = generateSecretKey();
    const localPubkey = getPublicKey(localSecret);
    const otherPubkey = getPublicKey(otherSecret);
    const connected = [];
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "true",
        MESHDROP_SERVER_ID: "local-server",
        MESHDROP_NOSTR_SECRET_KEY: utils.bytesToHex(localSecret),
        MESHDROP_DISCOVERY_NPUBS: nip19.npubEncode(getPublicKey(peerSecret))
    }));
    federation._connectPollenService = async (serverId, serviceName) => connected.push([serverId, serviceName]);

    const ignored = finalizeEvent({
        kind: 25051,
        created_at: 1,
        tags: [
            ["type", "pollen-federation"],
            ["p", otherPubkey],
            ["server", "remote-a"],
            ["service", "meshdrop-fed-a"]
        ],
        content: ""
    }, peerSecret);
    const accepted = finalizeEvent({
        kind: 25051,
        created_at: 2,
        tags: [
            ["type", "pollen-federation"],
            ["p", localPubkey],
            ["server", "remote-b"],
            ["service", "meshdrop-fed-b"]
        ],
        content: ""
    }, peerSecret);

    await federation._onNostrRelayMessage(JSON.stringify(["EVENT", "sub", ignored]));
    await federation._onNostrRelayMessage(JSON.stringify(["EVENT", "sub", accepted]));

    assert.deepEqual(connected, [["remote-b", "meshdrop-fed-b"]]);
});

test("federation receiveEvents dispatches peer and signal events", async () => {
    const handled = [];
    const federation = new MeshFederation(createFederationConfig({MESHDROP_FEDERATION: "false"}));
    federation.remoteServers.set("pollen:remote", {
        serverId: "remote",
        transport: "pollen",
        baseUrl: "http://127.0.0.1:9999"
    });
    federation.attachWsServer({
        _onFederationPeerJoined: event => handled.push(["joined", event.peer.id]),
        _onFederationPeerLeft: event => handled.push(["left", event.peerId]),
        _onFederationSignal: event => handled.push(["signal", event.to])
    });

    await federation.receiveEvents({
        serverId: "remote",
        transport: "pollen",
        events: [
            {type: "peer-joined", roomType: "pollen", roomId: "room", peer: {id: "peer-a"}},
            {type: "signal", roomType: "pollen", roomId: "room", to: "peer-b", sender: {id: "peer-a"}},
            {type: "peer-left", roomType: "pollen", roomId: "room", peerId: "peer-a"}
        ]
    });

    assert.deepEqual(handled, [
        ["joined", "peer-a"],
        ["signal", "peer-b"],
        ["left", "peer-a"]
    ]);
});

test("federation receiveEvents rejects events from undiscovered servers", async () => {
    const handled = [];
    const federation = new MeshFederation(createFederationConfig({MESHDROP_FEDERATION: "false"}));
    federation.attachWsServer({
        _onFederationPeerJoined: event => handled.push(event)
    });

    const result = await federation.receiveEvents({
        serverId: "attacker",
        transport: "fips",
        events: [{type: "peer-joined", roomType: "fips", roomId: "room", peer: {id: "fake-peer"}}]
    });

    assert.deepEqual(result, {accepted: 0, error: "unknown federation server"});
    assert.deepEqual(handled, []);
});

test("federation verifies reachable sender descriptor before accepting first events", async () => {
    const handled = [];
    const federation = new MeshFederation(createFederationConfig({MESHDROP_FEDERATION: "false"}));
    federation._discoverHttpServer = async server => {
        federation.remoteServers.set("fips:remote", {
            serverId: "remote",
            transport: "fips",
            baseUrl: server.baseUrl
        });
    };
    federation.attachWsServer({
        _onFederationPeerJoined: event => handled.push(event.peer.id)
    });

    const result = await federation.receiveEvents({
        serverId: "remote",
        transport: "fips",
        server: {
            serverId: "remote",
            transport: "fips",
            baseUrl: "http://[fd00::2]:3000"
        },
        events: [{type: "peer-joined", roomType: "fips", roomId: "room", peer: {id: "peer-a"}}]
    });

    assert.deepEqual(result, {accepted: 1});
    assert.deepEqual(handled, ["peer-a"]);
});

test("federation includes local return descriptor when relaying events", async () => {
    const posts = [];
    const originalFetch = globalThis.fetch;
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "false",
        MESHDROP_SERVER_ID: "local",
        FIPS_FEDERATION_URL: "http://[fd00::1]:3000"
    }));
    globalThis.fetch = async (url, options) => {
        posts.push({url, body: JSON.parse(options.body)});
        return {ok: true, json: async () => ({})};
    };

    try {
        await federation._postEvents({
            serverId: "remote",
            transport: "fips",
            baseUrl: "http://[fd00::2]:3000"
        }, [{type: "signal", roomType: "fips", roomId: "meshdrop-fips"}]);
    }
    finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].body.server, {
        serverId: "local",
        transport: "fips",
        baseUrl: "http://[fd00::1]:3000"
    });
});

test("federation sendSignal resolves registered server transport details", async () => {
    const posts = [];
    const originalFetch = globalThis.fetch;
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "false",
        MESHDROP_SERVER_ID: "local",
        FIPS_FEDERATION_URL: "http://[fd00::1]:3000"
    }));
    federation.remoteServers.set("fips:remote", {
        serverId: "remote",
        transport: "fips",
        baseUrl: "http://[fd00::2]:3000"
    });
    globalThis.fetch = async (url, options) => {
        posts.push({url, body: JSON.parse(options.body)});
        return {ok: true, json: async () => ({})};
    };

    try {
        federation.sendSignal(
            {serverId: "remote", transport: "fips"},
            {id: "sender"},
            {roomType: "fips", roomId: "meshdrop-fips", to: "recipient", sdp: {type: "offer"}}
        );
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, "http://[fd00::2]:3000/federation/events");
    assert.deepEqual(posts[0].body.events, [{
        type: "signal",
        roomType: "fips",
        roomId: "meshdrop-fips",
        to: "recipient",
        sender: {id: "sender"},
        sdp: {type: "offer"}
    }]);
});

test("federation listens to FIPS peer discovery events", async () => {
    let callback;
    const discovered = [];
    const removed = [];
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "true",
        FIPS_DISCOVERY: "true"
    }), {
        fipsClient: {
            listenPeerEvents(listener) {
                callback = listener;
                return {
                    close() {},
                    get active() {
                        return true;
                    }
                };
            }
        }
    });
    federation._discoverFipsPeer = async peer => discovered.push(peer.ipv6Addr);
    federation._removeFipsPeer = peer => removed.push(peer.ipv6Addr);

    federation._listenFipsPeerEvents();
    callback({type: "peer-joined", peer: {ipv6Addr: "fd00::2"}});
    callback({type: "peer-left", peer: {ipv6Addr: "fd00::2"}});

    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepEqual(discovered, ["fd00::2"]);
    assert.deepEqual(removed, ["fd00::2"]);
});

test("federation removes remote peers when a FIPS peer disappears", () => {
    const handled = [];
    const federation = new MeshFederation(createFederationConfig({
        MESHDROP_FEDERATION: "false",
        FIPS_ROOM: "meshdrop-fips"
    }));
    federation.attachWsServer({
        _onFederationPeerLeft: event => handled.push(event.peerId)
    });
    federation.remoteServers.set("fips:remote-server", {
        serverId: "remote-server",
        transport: "fips",
        baseUrl: "http://[fd00::2]:3000",
        peerIds: ["peer-a", "peer-b"]
    });

    federation._removeFipsPeer({ipv6Addr: "fd00::2"});

    assert.equal(federation.remoteServers.size, 0);
    assert.deepEqual(handled, ["peer-a", "peer-b"]);
});
