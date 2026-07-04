import test from "node:test";
import assert from "node:assert/strict";

await import("../public/scripts/ui.js");

const protocol = globalThis.PeerAvailabilityProtocol;

test("peer availability exposes local, WEB-RTC, FIPS, and Pollen room types", () => {
    const peer = {
        _roomIds: {
            fips: "meshdrop-fips",
            pollen: "meshdrop-pollen",
            nostr: "mesh:example",
            ip: "127.0.0.1"
        }
    };

    assert.deepEqual(
        protocol.availability(peer).map(option => [option.id, option.label, option.shortLabel]),
        [
            ["local", "Local", "LAN"],
            ["pollen-mesh", "Pollen Mesh", "Pollen"],
            ["fips", "FIPS", "FIPS"],
            ["webrtc", "WEB-RTC", "RTC"]
        ]
    );
});

test("transfer options prefer local when available and include enabled storage protocols", () => {
    const originalHashtree = globalThis.meshdropHashtreeTransfer;
    const originalBlossom = globalThis.meshdropBlossomTransfer;
    const originalPollen = globalThis.meshdropPollenTransfer;
    globalThis.meshdropHashtreeTransfer = {isActive: () => true};
    globalThis.meshdropBlossomTransfer = {isActive: () => true};
    globalThis.meshdropPollenTransfer = {isActive: () => true};

    try {
        const peer = {
            id: "visible-peer",
            _peerIdsByRoomType: {
                ip: "local-peer",
                pollen: "pollen-peer",
                nostr: "nostr-peer"
            },
            _roomIds: {
                nostr: "mesh:example",
                pollen: "meshdrop-pollen",
                ip: "127.0.0.1"
            }
        };

        assert.deepEqual(
            protocol.optionsFor(peer).map(option => [option.id, option.peerId || null]),
            [
                ["local", "local-peer"],
                ["pollen-mesh", "pollen-peer"],
                ["webrtc", "nostr-peer"],
                ["hashtree", null],
                ["blossom", null],
                ["pollen", null]
            ]
        );
    }
    finally {
        globalThis.meshdropHashtreeTransfer = originalHashtree;
        globalThis.meshdropBlossomTransfer = originalBlossom;
        globalThis.meshdropPollenTransfer = originalPollen;
    }
});

test("transfer options expose privacy and encryption metadata", () => {
    const originalHashtree = globalThis.meshdropHashtreeTransfer;
    const originalBlossom = globalThis.meshdropBlossomTransfer;
    const originalPollen = globalThis.meshdropPollenTransfer;
    globalThis.meshdropHashtreeTransfer = {isActive: () => true};
    globalThis.meshdropBlossomTransfer = {isActive: () => true};
    globalThis.meshdropPollenTransfer = {isActive: () => true};

    try {
        const options = protocol.optionsFor({
            id: "visible-peer",
            _roomIds: {
                ip: "127.0.0.1",
                pollen: "meshdrop-pollen",
                nostr: "mesh:example"
            }
        });
        const local = options.find(option => option.id === "local");
        const pollenMesh = options.find(option => option.id === "pollen-mesh");
        const webrtc = options.find(option => option.id === "webrtc");
        const hashtree = options.find(option => option.id === "hashtree");
        const blossom = options.find(option => option.id === "blossom");
        const pollen = options.find(option => option.id === "pollen");

        assert.equal(local.privacy, "Best privacy");
        assert.deepEqual(local.details.at(-1), ["Server access", "no file bytes"]);
        assert.equal(pollenMesh.privacy, "Direct after Pollen discovery");
        assert.deepEqual(pollenMesh.details.at(-1), ["Pollen carries", "server signaling, not file bytes"]);
        assert.deepEqual(webrtc.details.at(-1), ["Relays see", "signaling, not file bytes"]);
        assert.equal(hashtree.privacy, "Integrity, not secrecy");
        assert.deepEqual(hashtree.details.at(-1), ["Servers store", "readable file chunks"]);
        assert.equal(blossom.privacy, "Stored ciphertext");
        assert.deepEqual(blossom.details.at(-1), ["Servers store", "ciphertext only"]);
        assert.equal(pollen.privacy, "Storage handoff");
        assert.deepEqual(pollen.details.at(-1), ["Server sees", "plaintext upload and fetch"]);
    }
    finally {
        globalThis.meshdropHashtreeTransfer = originalHashtree;
        globalThis.meshdropBlossomTransfer = originalBlossom;
        globalThis.meshdropPollenTransfer = originalPollen;
    }
});

test("peer counts use actual MeshDrop room membership", () => {
    const peers = {
        a: {_roomIds: {fips: "meshdrop-fips"}},
        b: {_roomIds: {fips: "meshdrop-fips", nostr: "mesh:example"}},
        c: {_roomIds: {ip: "127.0.0.1"}}
    };

    assert.equal(protocol.countByRoomType(peers, "fips"), 2);
    assert.equal(protocol.countByRoomType(peers, "nostr"), 1);
});

test("generated display names are not treated as peer identity", () => {
    assert.deepEqual(
        protocol.identityKeys({
            id: "peer-a",
            name: {displayName: "Tan Owl"}
        }, "pollen"),
        []
    );

    assert.deepEqual(
        protocol.identityKeys({
            id: "peer-b",
            name: {displayName: "Tan Owl"},
            nostrIdentity: {pubkey: "1".repeat(64)}
        }, "pollen"),
        [`nostr:${"1".repeat(64)}`]
    );
});
