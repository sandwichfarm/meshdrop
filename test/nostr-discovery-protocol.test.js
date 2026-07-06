import test from "node:test";
import assert from "node:assert/strict";

globalThis.__meshdropDisableNostrRelayNetwork = true;

await import("../public/scripts/nostr-relays.js");
await import("../public/scripts/nostr-relay-globals.js");

const protocol = globalThis.NostrDiscoveryProtocol;

test("Nostr discovery uses requested bootstrap and WebRTC relays", () => {
    assert.deepEqual(protocol.bootstrapRelays, ["wss://purplepag.es", "wss://nos.lol"]);
    assert.deepEqual(protocol.rtcAnnouncementRelays, ["wss://bucket.coracle.social"]);
});

test("relay settings expose browser dialog globals with non-empty client defaults", () => {
    assert.equal(globalThis.meshdropRelaySettingsPreferences, globalThis.RelaySettingsPreferences);
    assert.equal(globalThis.meshdropNostrDiscoveryProtocol, globalThis.NostrDiscoveryProtocol);

    const settings = globalThis.meshdropRelaySettingsPreferences.normalize(
        globalThis.meshdropRelaySettingsPreferences.read()
    );

    assert.deepEqual(settings.bootstrapRelays, ["wss://purplepag.es", "wss://nos.lol"]);
    assert.deepEqual(settings.webRtcRelays, ["wss://bucket.coracle.social"]);
    assert.deepEqual(settings.inboxRelays, ["wss://purplepag.es", "wss://nos.lol"]);
    assert.deepEqual(settings.outboxRelays, ["wss://purplepag.es", "wss://nos.lol"]);
});

test("NIP-65 relay list parses read and write relay markers", () => {
    const relays = protocol.relayListFromEvent({
        kind: 10002,
        tags: [
            ["r", " wss://read.example/ ", "read"],
            ["r", "wss://write.example", "write"],
            ["r", "wss://both.example/"],
            ["r", "https://not-a-relay.example"]
        ]
    });

    assert.deepEqual(relays.read, ["wss://read.example", "wss://both.example"]);
    assert.deepEqual(relays.write, ["wss://write.example", "wss://both.example"]);
});

test("kind 0 profile metadata parses display name and picture", () => {
    const profile = protocol.profileFromEvent({
        kind: 0,
        content: JSON.stringify({
            display_name: " Alice  Nostr ",
            picture: "https://cdn.example/alice.png"
        })
    });

    assert.equal(profile.displayName, "Alice Nostr");
    assert.equal(profile.picture, "https://cdn.example/alice.png");
});

test("kind 3 contact list parses followed pubkeys", () => {
    const first = "a".repeat(64);
    const second = "b".repeat(64);
    const follows = protocol.followPubkeysFromEvent({
        kind: 3,
        tags: [
            ["p", first.toUpperCase()],
            ["p", second],
            ["p", "not-a-pubkey"],
            ["e", "c".repeat(64)],
            ["p", first]
        ]
    });

    assert.deepEqual(follows, [first, second]);
});

test("follow policy only allows pubkeys in the loaded contact list", () => {
    const followed = "c".repeat(64);
    const stranger = "d".repeat(64);
    const identity = {
        pubkey: "e".repeat(64),
        followListStatus: "found",
        followPubkeys: [followed]
    };

    assert.equal(globalThis.NostrFollowPolicy.allowsPubkey(followed, identity), true);
    assert.equal(globalThis.NostrFollowPolicy.allowsPubkey(stranger, identity), false);
    assert.equal(globalThis.NostrFollowPolicy.allowsPubkey(followed, {...identity, followListStatus: "loading"}), false);
});

test("follow policy gates Nostr relay peers without hiding local peers", () => {
    const followed = "f".repeat(64);
    const stranger = "0".repeat(64);
    const identity = {
        pubkey: "1".repeat(64),
        followListStatus: "found",
        followPubkeys: [followed]
    };

    assert.equal(globalThis.NostrFollowPolicy.allowsPeer({id: followed}, "nostr", identity), true);
    assert.equal(globalThis.NostrFollowPolicy.allowsPeer({id: stranger}, "nostr", identity), false);
    assert.equal(globalThis.NostrFollowPolicy.allowsPeer({id: "local-peer"}, "ip", identity), true);
    assert.equal(
        globalThis.NostrFollowPolicy.allowsPeer({id: "local-peer", nostrIdentity: {pubkey: stranger}}, "ip", identity),
        true
    );
    assert.equal(
        globalThis.NostrFollowPolicy.allowsPeer({id: stranger, _roomIds: {nostr: "mesh:room"}}, null, identity),
        false
    );
    assert.equal(
        globalThis.NostrFollowPolicy.allowsPeer({
            id: "local-peer",
            nostrIdentity: {pubkey: stranger},
            _roomIds: {ip: "127.0.0.1"}
        }, null, identity),
        true
    );
});

test("Blossom kind 10063 parses ordered server tags", () => {
    const servers = protocol.blossomServerUrlsFromEvent({
        kind: 10063,
        tags: [
            ["server", " https://blossom.example/ "],
            ["server", "https://cdn.example//"],
            ["server", "wss://relay.example"]
        ]
    });

    assert.deepEqual(servers, ["https://blossom.example", "https://cdn.example"]);
});
