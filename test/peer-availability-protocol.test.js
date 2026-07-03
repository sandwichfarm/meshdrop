import test from "node:test";
import assert from "node:assert/strict";

await import("../public/scripts/ui.js");

const protocol = globalThis.PeerAvailabilityProtocol;

test("peer availability exposes local, WEB-RTC, and FIPS room types", () => {
    const peer = {
        _roomIds: {
            fips: "meshdrop-fips",
            nostr: "mesh:example",
            ip: "127.0.0.1"
        }
    };

    assert.deepEqual(
        protocol.availability(peer).map(option => [option.id, option.label, option.shortLabel]),
        [
            ["local", "Local", "LAN"],
            ["webrtc", "WEB-RTC", "WEB"],
            ["fips", "FIPS", "FIPS"]
        ]
    );
});

test("transfer options prefer local when available and include enabled storage protocols", () => {
    const originalHashtree = globalThis.meshdropHashtreeTransfer;
    const originalBlossom = globalThis.meshdropBlossomTransfer;
    globalThis.meshdropHashtreeTransfer = {isActive: () => true};
    globalThis.meshdropBlossomTransfer = {isActive: () => true};

    try {
        const peer = {
            _roomIds: {
                nostr: "mesh:example",
                ip: "127.0.0.1"
            }
        };

        assert.deepEqual(
            protocol.optionsFor(peer).map(option => option.id),
            ["local", "webrtc", "hashtree", "blossom"]
        );
    }
    finally {
        globalThis.meshdropHashtreeTransfer = originalHashtree;
        globalThis.meshdropBlossomTransfer = originalBlossom;
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
