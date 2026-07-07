import test from "node:test";
import assert from "node:assert/strict";

await import("../public/scripts/ui.js");

const protocol = globalThis.PeerAvailabilityProtocol;
const routeStatus = globalThis.PeerRouteStatusProtocol;

function installRuntimeConfig(config) {
    const originalRuntimeCapabilities = globalThis.RuntimeCapabilities;
    globalThis.RuntimeCapabilities = {
        transportSupported(runtimeConfig, transport, fallback = false) {
            const capability = runtimeConfig?.capabilities?.transports?.[transport];
            if (typeof capability?.supported === "boolean") return capability.supported;

            return fallback;
        }
    };
    protocol.setConfig(config);

    return () => {
        protocol.setConfig(null);
        globalThis.RuntimeCapabilities = originalRuntimeCapabilities;
    };
}

test("peer availability exposes Instance, Clearnet, FIPS, Pollen, and Nostr-signaled room types", () => {
    const peer = {
        _roomIds: {
            fips: "meshdrop-fips",
            pollen: "meshdrop-pollen",
            nostr: "",
            ip: "127.0.0.1"
        }
    };

    assert.deepEqual(
        protocol.availability(peer).map(option => [option.id, option.label, option.shortLabel]),
        [
            ["local", "Instance", "Instance"],
            ["webrtc", "Clearnet via Nostr", "Clearnet"],
            ["fips", "FIPS", "FIPS"],
            ["pollen-mesh", "Pollen", "Pollen"]
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
                nostr: "",
                fips: "meshdrop-fips",
                pollen: "meshdrop-pollen",
                ip: "127.0.0.1"
            }
        };

        assert.deepEqual(
            protocol.optionsFor(peer).map(option => [option.id, option.peerId || null]),
            [
                ["local", "local-peer"],
                ["webrtc", "nostr-peer"],
                ["fips", "fips-peer"],
                ["pollen-mesh", "pollen-peer"],
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

test("backend-free config does not offer peer-advertised FIPS or Pollen as selectable routes", () => {
    const restore = installRuntimeConfig({
        capabilities: {
            runtime: {
                target: "spa",
                platform: "browser",
                hasBackend: false
            },
            transports: {
                localDiscovery: {supported: false},
                webrtc: {supported: true},
                nostr: {supported: true},
                fips: {supported: false, unavailableReason: "requires-instance-native-route"},
                pollen: {supported: false, unavailableReason: "requires-instance-native-route"}
            }
        }
    });

    try {
        const peer = {
            id: "peer-static",
            _peerIdsByRoomType: {
                nostr: "nostr-peer",
                fips: "fips-peer",
                pollen: "pollen-peer"
            },
            _roomIds: {
                nostr: "meshdrop-nostr",
                fips: "meshdrop-fips",
                pollen: "meshdrop-pollen"
            },
            routeCapabilities: ["fips", "pollen"]
        };

        assert.deepEqual(
            protocol.optionsFor(peer).map(option => [option.id, option.peerId || null]),
            [["webrtc", "nostr-peer"]]
        );
        assert.deepEqual(
            routeStatus.attemptsForPeer(peer).map(attempt => [attempt.route, attempt.state, attempt.reason]),
            [
                ["nostr", "candidate", ""],
                ["fips", "disabled", "Requires instance or native app"],
                ["pollen", "disabled", "Requires instance or native app"]
            ]
        );
    } finally {
        restore();
    }
});

test("backend-free config suppresses Pollen storage option without suppressing browser object stores", () => {
    const originalHashtree = globalThis.meshdropHashtreeTransfer;
    const originalBlossom = globalThis.meshdropBlossomTransfer;
    const originalPollen = globalThis.meshdropPollenTransfer;
    const restore = installRuntimeConfig({
        capabilities: {
            transports: {
                hashtree: {supported: true},
                blossom: {supported: true},
                pollen: {supported: false, unavailableReason: "requires-instance-native-route"}
            }
        }
    });
    globalThis.meshdropHashtreeTransfer = {isActive: () => true};
    globalThis.meshdropBlossomTransfer = {isActive: () => true};
    globalThis.meshdropPollenTransfer = {isActive: () => true};

    try {
        assert.deepEqual(
            protocol.optionsFor({}).map(option => option.id),
            ["hashtree", "blossom"]
        );
    }
    finally {
        globalThis.meshdropHashtreeTransfer = originalHashtree;
        globalThis.meshdropBlossomTransfer = originalBlossom;
        globalThis.meshdropPollenTransfer = originalPollen;
        restore();
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
                fips: "meshdrop-fips",
                pollen: "meshdrop-pollen",
                nostr: "mesh:example"
            }
        });
        const local = options.find(option => option.id === "local");
        const fipsMesh = options.find(option => option.id === "fips");
        const pollenMesh = options.find(option => option.id === "pollen-mesh");
        const webrtc = options.find(option => option.id === "webrtc");
        const hashtree = options.find(option => option.id === "hashtree");
        const blossom = options.find(option => option.id === "blossom");
        const pollen = options.find(option => option.id === "pollen");

        assert.equal(local.group, "Network routes");
        assert.equal(local.privacy, "Instance-assisted path");
        assert.deepEqual(local.details, [
            ["Discovery", "same MeshDrop instance"],
            ["Data path", "clearnet WebRTC ICE"],
            ["Exclude with", "Instance toggle"]
        ]);
        assert.equal(fipsMesh.group, "Network routes");
        assert.equal(fipsMesh.privacy, "FIPS signaling, ICE data path");
        assert.deepEqual(fipsMesh.details, [
            ["Signaling", "FIPS substrate"],
            ["Data path", "browser WebRTC ICE"],
            ["Clearnet bytes", "possible unless relay-only ICE exists"]
        ]);
        assert.equal(pollenMesh.group, "Network routes");
        assert.equal(pollenMesh.privacy, "Pollen signaling, ICE data path");
        assert.deepEqual(pollenMesh.details, [
            ["Signaling", "Pollen substrate"],
            ["Data path", "browser WebRTC ICE"],
            ["Clearnet bytes", "possible unless relay-only ICE exists"]
        ]);
        assert.equal(webrtc.label, "Clearnet via Nostr");
        assert.equal(webrtc.privacy, "Direct clearnet path");
        assert.deepEqual(webrtc.details.at(0), ["Discovery", "Nostr WOT"]);
        assert.deepEqual(webrtc.details.at(1), ["Data path", "clearnet WebRTC ICE"]);
        assert.deepEqual(webrtc.details.at(-1), ["Nostr events", "discovery/signaling only"]);
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
        b: {_roomIds: {fips: "meshdrop-fips", nostr: ""}},
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
        d: {_roomIds: {nostr: ""}}
    };

    assert.deepEqual(
        protocol.networkPostureCounts(peers).map(entry => [entry.id, entry.count, entry.shortLabel]),
        [
            ["local", 1, "Instance"],
            ["webrtc", 1, "Clearnet"],
            ["fips", 2, "FIPS"],
            ["pollen-mesh", 2, "Pollen"]
        ]
    );
});

test("private payload mode is disabled when Web Crypto is unavailable", () => {
    const originalBlossom = globalThis.BlossomTransferProtocol;
    globalThis.BlossomTransferProtocol = {hasWebCrypto: () => false};

    try {
        assert.equal(protocol.privateTransferAvailable(), false);
        assert.equal(protocol.privacyModeAvailable("private"), false);
        assert.equal(protocol.privacyModeAvailable("unencrypted"), true);
        assert.equal(protocol.defaultPrivacyMode(), "unencrypted");
    }
    finally {
        globalThis.BlossomTransferProtocol = originalBlossom;
    }
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

test("Nostr identity keys normalize pubkey case before grouping peers", () => {
    assert.deepEqual(
        protocol.identityKeys({
            id: "peer-c",
            nostrIdentity: {pubkey: "A".repeat(64)}
        }, "ip"),
        [`nostr:${"a".repeat(64)}`]
    );
});

test("route status text names the active network and phase", () => {
    assert.equal(routeStatus.text({route: "nostr", state: "connecting"}), "Connecting on Clearnet...");
    assert.equal(routeStatus.text({route: "fips", state: "requested"}), "Trying FIPS...");
    assert.equal(routeStatus.text({route: "fips", state: "ice-checking"}), "Checking FIPS ICE...");
    assert.equal(routeStatus.text({route: "pollen", state: "timeout"}), "Pollen timed out");
    assert.equal(routeStatus.text({route: "ip", state: "failed"}), "Instance failed");
    assert.equal(routeStatus.text({route: "nostr", state: "connected"}), "Connected on Clearnet");
    assert.equal(routeStatus.text({route: "nostr", state: "disabled"}), "Clearnet disabled");
    assert.equal(routeStatus.statusKey({route: "fips", state: "ice-checking"}), "route-fips-ice-checking");
});

test("pending private route status shows FIPS or Pollen instead of Clearnet", () => {
    assert.deepEqual(
        protocol.availability({
            _roomIds: {},
            routeStatus: {route: "fips", state: "requested"}
        }).map(option => [option.id, option.shortLabel]),
        [["fips", "FIPS"]]
    );

    assert.deepEqual(
        protocol.availability({
            _roomIds: {},
            routeStatus: {route: "nostr", state: "disabled"}
        }).map(option => [option.id, option.shortLabel]),
        []
    );
});

test("PeersUI maps disabled Nostr discovery with private capability to pending FIPS route", () => {
    const originalPolicy = globalThis.ClearnetRoutePolicy;
    const ui = Object.create(globalThis.PeersUI.prototype);
    globalThis.ClearnetRoutePolicy = {
        allows: roomType => roomType !== "nostr"
    };

    try {
        assert.equal(ui._routeAllowed("nostr"), false);
        assert.deepEqual(ui._pendingPrivateRouteStatus({
            id: "peer-pubkey",
            routeCapabilities: ["fips", "pollen"],
            nostrIdentity: {pubkey: "peer-pubkey"}
        }), {
            peerId: "peer-pubkey",
            route: "fips",
            roomType: "fips",
            routePeerId: "peer-pubkey",
            state: "requested",
            reason: "clearnet-disabled",
            routes: []
        });
    }
    finally {
        globalThis.ClearnetRoutePolicy = originalPolicy;
    }
});
