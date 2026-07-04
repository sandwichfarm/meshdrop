import test from "node:test";
import assert from "node:assert/strict";

import PairDropWsServer from "../server/ws-server.js";

function createServerHarness() {
    const sent = [];
    const server = Object.create(PairDropWsServer.prototype);
    server._rooms = {};
    server._send = (peer, message) => sent.push({peer: peer.id, message});
    return {server, sent};
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
