import test from "node:test";
import assert from "node:assert/strict";

import PairDropWsServer from "../server/ws-server.js";

function createServerHarness() {
    const sent = [];
    const forwarded = [];
    const server = Object.create(PairDropWsServer.prototype);
    server._rooms = {};
    server._send = (peer, message) => sent.push({peer: peer.id, message});
    server._conf = {
        fips: {room: ""},
        federation: {pollen: {room: ""}},
        federationClient: {
            localPeerJoined(roomType, roomId, peerInfo) {
                forwarded.push({type: "joined", roomType, roomId, peerInfo});
            },
            localPeerLeft(roomType, roomId, peerId) {
                forwarded.push({type: "left", roomType, roomId, peerId});
            }
        }
    };
    return {server, sent, forwarded};
}

function createPeer(id) {
    return {
        id,
        getInfo() {
            return {id, rtcSupported: true};
        }
    };
}

test("joining the same room twice from the same websocket is idempotent", () => {
    const {server, sent} = createServerHarness();
    const peer = createPeer("peer-a");

    server._joinRoom(peer, "ip", "127.0.0.1");
    server._joinRoom(peer, "ip", "127.0.0.1");

    assert.equal(server._rooms["127.0.0.1"]["peer-a"], peer);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].message, {type: "peers", peers: [], roomType: "ip", roomId: "127.0.0.1"});
});

test("rejoining with the same peer id replaces the stale websocket without peer-left noise", () => {
    const {server, sent} = createServerHarness();
    const oldPeer = createPeer("peer-a");
    const newPeer = createPeer("peer-a");
    const otherPeer = createPeer("peer-b");

    server._joinRoom(oldPeer, "ip", "127.0.0.1");
    server._joinRoom(otherPeer, "ip", "127.0.0.1");
    sent.length = 0;

    server._joinRoom(newPeer, "ip", "127.0.0.1");

    assert.equal(server._rooms["127.0.0.1"]["peer-a"], newPeer);
    assert.equal(sent.some(entry => entry.message.type === "peer-left"), false);
    assert.equal(sent.some(entry => entry.message.type === "peer-joined"), true);
});

test("FIPS join uses runtime npub rooms from the browser", () => {
    const {server, forwarded} = createServerHarness();
    const peer = createPeer("peer-a");
    const rooms = ["npub-network:runtime-a", "npub-network:runtime-b"];

    server._joinFipsRoom(peer, server._roomIdsFromJoinMessage({rooms}));

    assert.deepEqual(peer.fipsRoomIds, rooms);
    assert.equal(server._rooms["fips\nnpub-network:runtime-a"]["peer-a"], peer);
    assert.equal(server._rooms["fips\nnpub-network:runtime-b"]["peer-a"], peer);
    assert.deepEqual(forwarded.map(event => event.roomId), rooms);
});

test("empty runtime npub room list does not join discovery rooms", () => {
    const {server} = createServerHarness();
    const peer = createPeer("peer-a");

    server._joinFipsRoom(peer, server._roomIdsFromJoinMessage({rooms: []}));

    assert.deepEqual(peer.fipsRoomIds, []);
    assert.equal(peer.fipsRoomId, null);
    assert.deepEqual(server._rooms, {});
});

test("FIPS join without runtime rooms does not join discovery rooms", () => {
    const {server} = createServerHarness();
    const peer = createPeer("peer-a");

    server._joinFipsRoom(peer, server._roomIdsFromJoinMessage({}));

    assert.deepEqual(peer.fipsRoomIds, []);
    assert.equal(peer.fipsRoomId, null);
    assert.deepEqual(server._rooms, {});
});
