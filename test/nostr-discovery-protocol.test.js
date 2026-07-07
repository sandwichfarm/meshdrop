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
    assert.deepEqual(settings.inboxRelays, []);
    assert.deepEqual(settings.outboxRelays, []);
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

test("Nostr relay lookup reads NIP-65 from bootstrap and follows from bootstrap plus inbox and outbox", async () => {
    const pubkey = "a".repeat(64);
    const followed = "b".repeat(64);
    const calls = [];
    const pool = new globalThis.NostrRelayPool({bootstrapRelays: ["wss://bootstrap.example"]});
    pool.fetchLatestEvent = async (relayUrls, filter) => {
        calls.push({relayUrls, filter});
        if (filter.kinds[0] === protocol.relayListKind) {
            return {
                kind: protocol.relayListKind,
                pubkey,
                created_at: 1,
                tags: [
                    ["r", "wss://read.example", "read"],
                    ["r", "wss://write.example", "write"]
                ]
            };
        }
        if (filter.kinds[0] === protocol.contactListKind) {
            return {
                kind: protocol.contactListKind,
                pubkey,
                created_at: 1,
                tags: [["p", followed]]
            };
        }
        return null;
    };

    const discovery = await pool.lookupUser(pubkey);
    const relayListCall = calls.find(call => call.filter.kinds[0] === protocol.relayListKind);
    const followListCall = calls.find(call => call.filter.kinds[0] === protocol.contactListKind);

    assert.deepEqual(discovery.relays.read, ["wss://read.example"]);
    assert.deepEqual(discovery.relays.write, ["wss://write.example"]);
    assert.equal(discovery.relays.status, "found");
    assert.deepEqual(discovery.followPubkeys, [followed]);
    assert.deepEqual(relayListCall.relayUrls, ["wss://bootstrap.example"]);
    assert.deepEqual(followListCall.relayUrls, [
        "wss://bootstrap.example",
        "wss://read.example",
        "wss://write.example"
    ]);
});

test("Nostr relay lookup keeps missing NIP-65 distinct from bootstrap fallback", async () => {
    const pubkey = "c".repeat(64);
    const followed = "d".repeat(64);
    const calls = [];
    const pool = new globalThis.NostrRelayPool({bootstrapRelays: ["wss://bootstrap.example"]});
    pool.fetchLatestEvent = async (relayUrls, filter) => {
        calls.push({relayUrls, filter});
        if (filter.kinds[0] === protocol.contactListKind) {
            return {
                kind: protocol.contactListKind,
                pubkey,
                created_at: 1,
                tags: [["p", followed]]
            };
        }
        return null;
    };

    const discovery = await pool.lookupUser(pubkey);
    const followListCall = calls.find(call => call.filter.kinds[0] === protocol.contactListKind);

    assert.deepEqual(discovery.relays.read, []);
    assert.deepEqual(discovery.relays.write, []);
    assert.equal(discovery.relays.status, "missing");
    assert.deepEqual(discovery.followPubkeys, [followed]);
    assert.deepEqual(followListCall.relayUrls, ["wss://bootstrap.example"]);
});

test("npub network rooms are pairwise and derived from the loaded follow set", async () => {
    const local = "e".repeat(64);
    const first = "f".repeat(64);
    const second = "1".repeat(64);
    const rooms = await globalThis.NpubNetworkProtocol.roomsForIdentity({
        pubkey: local,
        followPubkeys: [first, second, "not-a-pubkey", local]
    });
    const firstRoom = await globalThis.NpubNetworkProtocol.pairwiseRoom(local, first);
    const firstRoomReversed = await globalThis.NpubNetworkProtocol.pairwiseRoom(first, local);

    assert.equal(rooms.length, 2);
    assert(rooms.every(room => /^npub-network:[a-f0-9]{32}$/.test(room)));
    assert.equal(firstRoom, firstRoomReversed);
    assert(rooms.includes(firstRoom));
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

test("follow policy allows only trusted Nostr peers without hiding local peers", () => {
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
