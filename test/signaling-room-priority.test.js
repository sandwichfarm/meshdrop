import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};

await import("../public/scripts/network.js");

test("signaling room priority prefers local discovery over pending Nostr signaling", () => {
    const priority = globalThis.SignalingRoomPriority;

    assert.equal(priority.primary({nostr: "meshdrop:example.test"}), "nostr");
    assert.equal(priority.shouldPrefer("nostr", "ip", false), true);
    assert.equal(priority.shouldPrefer("nostr", "ip", true), false);
    assert.deepEqual(
        priority.withPreferred({nostr: "meshdrop:example.test"}, "ip", "127.0.0.1"),
        {ip: "127.0.0.1", nostr: "meshdrop:example.test"}
    );
});

test("signaling room priority prefers mesh Pollen over relay Nostr while still preferring local", () => {
    const priority = globalThis.SignalingRoomPriority;

    assert.equal(priority.shouldPrefer("nostr", "pollen", false), true);
    assert.equal(priority.shouldPrefer("pollen", "ip", false), true);
    assert.equal(priority.shouldPrefer("pollen", "nostr", false), false);
});

test("server identity key ignores profile-only Nostr identity hydration changes", () => {
    const protocol = globalThis.ServerConnectionIdentityProtocol;
    const base = {
        pubkey: "a".repeat(64),
        event: {
            id: "event-id",
            sig: "event-sig"
        },
        displayName: "Alice",
        followListStatus: "loading"
    };

    assert.equal(
        protocol.key(base),
        protocol.key({
            ...base,
            displayName: "Alice Updated",
            picture: "https://example.test/alice.png",
            followListStatus: "found",
            followPubkeys: ["b".repeat(64)]
        })
    );

    assert.notEqual(protocol.key(base), protocol.key({...base, pubkey: "c".repeat(64)}));
    assert.notEqual(protocol.key(base), protocol.key({...base, event: {...base.event, sig: "new-sig"}}));
    assert.equal(protocol.key(null), "");
});

test("server identity payload omits hydrated discovery metadata", () => {
    const protocol = globalThis.ServerConnectionIdentityProtocol;
    const event = {
        id: "event-id",
        sig: "event-sig",
        pubkey: "a".repeat(64)
    };
    const payload = protocol.serverIdentity({
        pubkey: "a".repeat(64),
        event,
        displayName: "Alice",
        picture: "https://example.test/alice.png",
        relays: {
            read: ["wss://purplepag.es", "wss://nos.lol"],
            write: ["wss://purplepag.es"]
        },
        blossomServers: ["https://blossom.example.test"],
        followListStatus: "found",
        followPubkeys: Array.from({length: 500}, (_, index) => index.toString(16).padStart(64, "0"))
    });

    assert.deepEqual(payload, {
        pubkey: "a".repeat(64),
        event
    });
    assert.ok(JSON.stringify(payload).length < 4096);
});

test("stored server identity reads only the signed auth event", () => {
    const protocol = globalThis.ServerConnectionIdentityProtocol;
    const event = {
        id: "event-id",
        sig: "event-sig",
        pubkey: "b".repeat(64)
    };
    const storage = {
        getItem(key) {
            assert.equal(key, "meshdrop_nostr_identity");
            return JSON.stringify({
                pubkey: "b".repeat(64),
                event,
                followPubkeys: ["c".repeat(64)]
            });
        }
    };

    assert.deepEqual(protocol.storedServerIdentity(storage), {
        pubkey: "b".repeat(64),
        event
    });
});
