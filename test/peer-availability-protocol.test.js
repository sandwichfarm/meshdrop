import test from "node:test";
import assert from "node:assert/strict";

await import("../public/scripts/ui.js");

const protocol = globalThis.PeerAvailabilityProtocol;

test("peer availability exposes instance, FIPS, Pollen, and relay room types", () => {
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
            ["local", "Instance", "Instance"],
            ["fips", "FIPS", "FIPS"],
            ["pollen-mesh", "Pollen", "Pollen"],
            ["webrtc", "Nostr relay", "Relay"]
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
                fips: "fips-peer",
                pollen: "pollen-peer",
                nostr: "nostr-peer"
            },
            _roomIds: {
                nostr: "mesh:example",
                fips: "meshdrop-fips",
                pollen: "meshdrop-pollen",
                ip: "127.0.0.1"
            }
        };

        assert.deepEqual(
            protocol.optionsFor(peer).map(option => [option.id, option.peerId || null]),
            [
                ["local", "local-peer"],
                ["fips", "fips-peer"],
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

        assert.equal(local.group, "Network routes");
        assert.equal(local.privacy, "Direct peer path");
        assert.deepEqual(local.details, [
            ["Discovery", "same MeshDrop instance"],
            ["Data path", "WebRTC ICE direct"],
            ["Best case", "local network candidate"]
        ]);
        assert.equal(pollenMesh.group, "Network routes");
        assert.equal(pollenMesh.privacy, "P2P after Pollen discovery");
        assert.deepEqual(pollenMesh.details.at(-1), ["Best case", "local network candidate"]);
        assert.equal(webrtc.label, "Nostr relay");
        assert.deepEqual(webrtc.details.at(-1), ["Relays see", "signaling only"]);
        assert.equal(hashtree.group, "Storage routes");
        assert.equal(hashtree.privacy, "Integrity, not secrecy");
        assert.deepEqual(hashtree.details.at(-1), ["Unencrypted", "servers see chunks"]);
        assert.equal(blossom.group, "Storage routes");
        assert.equal(blossom.privacy, "Stored ciphertext");
        assert.deepEqual(blossom.details.at(-1), ["Servers store", "ciphertext only"]);
        assert.equal(pollen.privacy, "Storage handoff");
        assert.deepEqual(pollen.details.at(-1), ["Unencrypted", "server sees files"]);
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

test("peer counts summarize network posture badges", () => {
    const peers = {
        a: {_roomIds: {ip: "127.0.0.1", fips: "meshdrop-fips"}},
        b: {_roomIds: {pollen: "meshdrop-pollen"}},
        c: {_roomIds: {fips: "meshdrop-fips", pollen: "meshdrop-pollen"}},
        d: {_roomIds: {nostr: "mesh:example"}}
    };

    assert.deepEqual(
        protocol.networkPostureCounts(peers).map(entry => [entry.id, entry.count, entry.shortLabel]),
        [
            ["local", 1, "Instance"],
            ["fips", 2, "FIPS"],
            ["pollen-mesh", 2, "Pollen"],
            ["webrtc", 1, "Relay"]
        ]
    );
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
