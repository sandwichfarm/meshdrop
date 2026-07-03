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
        globalThis.NostrMeshProtocol.signalContent({ice: {candidate: "candidate"}}),
        {ice: {candidate: "candidate"}}
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
