import test from "node:test";
import assert from "node:assert/strict";

globalThis.location = {host: "meshdrop.test"};
globalThis.__meshdropDisableNostrRelayNetwork = true;
const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
};
await import("../public/scripts/nostr-relays.js");
await import("../public/scripts/nostr-mesh.js");

test("Nostr mesh protocol uses NIP-100 draft kind and configured room", () => {
    assert.equal(globalThis.NostrMeshProtocol.kind, 25050);
    assert.equal(globalThis.NostrMeshProtocol.presenceHeartbeatMs, 25000);
    assert.equal(
        globalThis.NostrMeshProtocol.roomFromConfig({nostrMesh: {room: "mesh"}}),
        "mesh:meshdrop.test"
    );
});

test("Nostr mesh protocol uses bucket relay by default and trims configured relays", () => {
    localStorage.clear();
    assert.deepEqual(
        globalThis.NostrMeshProtocol.relayUrlsFromConfig({}),
        ["wss://bucket.coracle.social"]
    );

    assert.deepEqual(
        globalThis.NostrMeshProtocol.relayUrlsFromConfig({
            nostrMesh: {relays: [" wss://relay.example ", "", "ws://localhost:7777"]}
        }),
        ["wss://relay.example", "ws://localhost:7777"]
    );
});

test("relay settings override bootstrap and WebRTC relay lists", () => {
    const settings = globalThis.RelaySettingsPreferences.write({
        bootstrapRelays: [" wss://bootstrap.example ", "https://invalid.example"],
        webRtcRelays: ["wss://rtc.example/"],
        inboxRelays: ["wss://read.example"],
        outboxRelays: ["wss://write.example"]
    });

    globalThis.meshdropNostrRelays.refreshSettings();

    assert.deepEqual(settings.bootstrapRelays, ["wss://bootstrap.example"]);
    assert.deepEqual(globalThis.meshdropNostrRelays.bootstrapRelays, ["wss://bootstrap.example"]);
    assert.deepEqual(globalThis.NostrMeshProtocol.relayUrlsFromConfig({}), ["wss://rtc.example"]);
    assert.deepEqual(
        globalThis.RelaySettingsPreferences.relayListTags(settings.inboxRelays, settings.outboxRelays),
        [
            ["r", "wss://read.example", "read"],
            ["r", "wss://write.example", "write"]
        ]
    );
});

test("Nostr mesh protocol maps PairDrop RTC signals to draft event types", () => {
    assert.equal(
        globalThis.NostrMeshProtocol.signalType({sdp: {type: "offer", sdp: "v=0"}}),
        "offer"
    );
    assert.deepEqual(
        globalThis.NostrMeshProtocol.signalContent({ice: {candidate: "candidate"}, sessionId: "session-1"}),
        {ice: {candidate: "candidate"}, sessionId: "session-1"}
    );
});

test("Nostr mesh protocol parses incoming draft event tags", () => {
    const event = {
        pubkey: "a".repeat(64),
        tags: [
            ["type", "connect"],
            ["r", "mesh:meshdrop.test"],
            ["p", "b".repeat(64)],
            ["name", "Alice"]
        ]
    };

    assert.equal(globalThis.NostrMeshProtocol.eventType(event), "connect");
    assert.equal(globalThis.NostrMeshProtocol.room(event), "mesh:meshdrop.test");
    assert.equal(globalThis.NostrMeshProtocol.recipient(event), "b".repeat(64));
    assert.equal(globalThis.NostrMeshProtocol.peerFromEvent(event).name.displayName, "Alice");
});

test("Nostr mesh only handles events from followed pubkeys", () => {
    const followed = "a".repeat(64);
    const stranger = "b".repeat(64);
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    mesh._seenEvents = new Set();
    mesh._room = "mesh:meshdrop.test";
    mesh._identity = {
        pubkey: "c".repeat(64),
        followListStatus: "found",
        followPubkeys: [followed]
    };

    const event = pubkey => ({
        id: pubkey,
        kind: globalThis.NostrMeshProtocol.kind,
        pubkey,
        tags: [
            ["type", "connect"],
            ["r", "mesh:meshdrop.test"]
        ]
    });

    assert.equal(mesh._shouldHandleEvent(event(followed)), true);
    assert.equal(mesh._shouldHandleEvent(event(stranger)), false);
});

test("Nostr mesh republishes ephemeral WEB-RTC presence on a heartbeat", () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const intervals = [];
    const cleared = [];
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    let publishCount = 0;

    globalThis.setInterval = (callback, ms) => {
        intervals.push({callback, ms});
        return intervals.length;
    };
    globalThis.clearInterval = id => cleared.push(id);

    try {
        mesh._presenceHeartbeatId = null;
        mesh._publishPresence = type => {
            assert.equal(type, "connect");
            publishCount += 1;
        };

        mesh._startPresenceHeartbeat();
        assert.equal(intervals.length, 1);
        assert.equal(intervals[0].ms, globalThis.NostrMeshProtocol.presenceHeartbeatMs);

        intervals[0].callback();
        assert.equal(publishCount, 1);

        mesh._stopPresenceHeartbeat();
        assert.deepEqual(cleared, [1]);
        assert.equal(mesh._presenceHeartbeatId, null);
    }
    finally {
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
    }
});

test("Nostr mesh reports relay publish rejections without treating them as events", () => {
    const originalWarn = console.warn;
    const warnings = [];
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);

    console.warn = (...args) => warnings.push(args);

    try {
        mesh._onRelayMessage(JSON.stringify(["OK", "event-id", false, "blocked: unsupported kind"]));

        assert.equal(warnings.length, 1);
        assert.equal(warnings[0][0], "Nostr mesh relay rejected publish");
        assert.equal(warnings[0][1], "event-id");
        assert.equal(warnings[0][2], "blocked: unsupported kind");
    }
    finally {
        console.warn = originalWarn;
    }
});

test("Nostr mesh keeps active connections across same-pubkey identity hydration", () => {
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    let disconnectCount = 0;

    mesh._identity = {pubkey: "a".repeat(64), displayName: "Alice"};
    mesh._render = () => {};
    mesh.disconnect = () => {
        disconnectCount += 1;
    };

    mesh._onIdentityChanged({
        pubkey: "a".repeat(64),
        displayName: "Alice Updated",
        followListStatus: "found"
    });

    assert.equal(disconnectCount, 0);
    assert.equal(mesh._identity.displayName, "Alice Updated");
    assert.equal(mesh._identity.followListStatus, "found");

    mesh._onIdentityChanged({pubkey: "b".repeat(64)});
    assert.equal(disconnectCount, 1);
});

test("Nostr mesh disconnect removes known Nostr peers from the UI model", () => {
    const originalEvents = globalThis.Events;
    const fired = [];
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);

    globalThis.Events = {
        fire(type, detail) {
            fired.push({type, detail});
        }
    };

    try {
        mesh._active = true;
        mesh._sockets = new Map();
        mesh._peers = new Set(["a".repeat(64), "b".repeat(64)]);
        mesh._room = "mesh:meshdrop.test";
        mesh._publishPresence = () => {};
        mesh._stopPresenceHeartbeat = () => {};
        mesh._render = () => {};

        mesh.disconnect(false);

        assert.deepEqual(
            fired.filter(event => event.type === "peer-left").map(event => event.detail.peerId),
            ["a".repeat(64), "b".repeat(64)]
        );
        assert.equal(mesh._peers.size, 0);
    }
    finally {
        globalThis.Events = originalEvents;
    }
});
