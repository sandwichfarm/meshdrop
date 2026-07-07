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

test("Nostr mesh protocol uses NIP-100 draft kind and no static room by default", () => {
    assert.equal(globalThis.NostrMeshProtocol.kind, 25050);
    assert.equal(globalThis.NostrMeshProtocol.presenceHeartbeatMs, 25000);
    assert.equal(
        globalThis.NostrMeshProtocol.networkId({pubkey: "a".repeat(64)}),
        ""
    );
    assert.equal(
        globalThis.NostrMeshProtocol.networkId({pubkey: "a".repeat(64)}, {nostrMesh: {room: "meshdrop-lab"}}),
        "meshdrop-lab"
    );
});

test("Nostr mesh subscriptions use trusted authors unless an explicit room is configured", () => {
    const trusted = "2".repeat(64);

    assert.deepEqual(
        globalThis.NostrMeshProtocol.subscriptionFilters({
            pubkey: "1".repeat(64),
            followListStatus: "found",
            followPubkeys: [trusted, "not-a-pubkey"]
        }, {}, 10),
        [{
            kinds: [25050],
            since: 10,
            authors: [trusted]
        }]
    );
    assert.deepEqual(
        globalThis.NostrMeshProtocol.subscriptionFilters({pubkey: "1".repeat(64), followPubkeys: []}, {}, 10),
        []
    );
    assert.deepEqual(
        globalThis.NostrMeshProtocol.subscriptionFilters(
            {pubkey: "1".repeat(64), followPubkeys: [trusted]},
            {nostrMesh: {room: "debug-room"}},
            10
        ),
        [{kinds: [25050], since: 10, "#r": ["debug-room"]}]
    );
});

test("Nostr mesh presence advertises MeshDrop WebRTC capability without a default room", async () => {
    const signedEvents = [];
    const originalFips = globalThis.meshdropFipsDiscovery;
    const originalPollen = globalThis.meshdropPollenTransfer;
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    mesh._room = "";
    mesh._sessionPeerId = "session-peer";
    mesh._identity = {
        pubkey: "1".repeat(64),
        displayName: "Alice",
        followListStatus: "found",
        followPubkeys: ["2".repeat(64), "3".repeat(64), "2".repeat(64), "1".repeat(64)]
    };
    mesh._publishEvent = event => signedEvents.push(event);
    mesh._signEvent = async event => ({...event, id: "event-id", sig: "sig", pubkey: mesh._identity.pubkey});

    globalThis.meshdropFipsDiscovery = {isActive: () => true};
    globalThis.meshdropPollenTransfer = {isActive: () => false};

    try {
        await mesh._publishPresence("connect");
    }
    finally {
        globalThis.meshdropFipsDiscovery = originalFips;
        globalThis.meshdropPollenTransfer = originalPollen;
    }

    const tags = signedEvents[0].tags;
    const serializedTags = JSON.stringify(tags);
    assert.deepEqual(tags.filter(tag => tag[0] === "p"), []);
    assert.equal(tags.some(tag => tag[0] === "r"), false);
    assert.equal(tags.some(tag => tag[0] === "name"), false);
    assert.equal(serializedTags.includes("Alice"), false);
    assert.equal(serializedTags.includes("Macintosh"), false);
    assert.equal(serializedTags.includes("pollen-service"), false);
    assert.equal(serializedTags.includes("fips/status"), false);
    assert(tags.some(tag => tag[0] === "client" && tag[1] === "meshdrop"));
    assert(tags.some(tag => tag[0] === "capability" && tag[1] === "meshdrop"));
    assert(tags.some(tag => tag[0] === "capability" && tag[1] === "webrtc"));
    assert(tags.some(tag => tag[0] === "capability" && tag[1] === "fips-route"));
    assert.equal(tags.some(tag => tag[0] === "capability" && tag[1] === "pollen-route"), false);
    assert(tags.some(tag => tag[0] === "peer" && tag[1] === "session-peer"));
    assert(tags.some(tag => tag[0] === "expiration" && Number(tag[1]) > 0));
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

test("relay settings expose UI alias and default to discovered NIP-65 relays", () => {
    localStorage.clear();

    assert.equal(globalThis.meshdropRelaySettingsPreferences, globalThis.RelaySettingsPreferences);
    assert.equal(globalThis.RelaySettingsPreferences.hasStoredSettings(), false);

    const settings = globalThis.RelaySettingsPreferences.displaySettings({
        relays: {
            read: ["wss://read-nip65.example"],
            write: ["wss://write-nip65.example"]
        }
    });

    assert.deepEqual(settings.bootstrapRelays, ["wss://purplepag.es", "wss://nos.lol"]);
    assert.deepEqual(settings.webRtcRelays, ["wss://bucket.coracle.social"]);
    assert.deepEqual(settings.inboxRelays, ["wss://read-nip65.example"]);
    assert.deepEqual(settings.outboxRelays, ["wss://write-nip65.example"]);
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

test("Nostr mesh route requests use NIP-44 and accepted responses join descriptor rooms", async () => {
    const localPubkey = "1".repeat(64);
    const peerPubkey = "2".repeat(64);
    const room = await globalThis.NpubNetworkProtocol.pairwiseRoom(localPubkey, peerPubkey);
    const signedEvents = [];
    const encrypted = [];
    const joined = [];
    const originalFips = globalThis.meshdropFipsDiscovery;
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    mesh._active = true;
    mesh._room = "";
    mesh._sessionPeerId = "session-local";
    mesh._pendingRouteRequests = new Map();
    mesh._identity = {pubkey: localPubkey};
    mesh._identityController = {
        canNip44: () => true,
        encryptNip44To: async (pubkey, plaintext) => {
            encrypted.push({pubkey, plaintext});
            return `ciphertext:${pubkey}`;
        },
        decryptNip44From: async () => JSON.stringify({
            type: "route-response",
            routeType: "fips",
            nonce: mesh._pendingRouteRequests.get(`${peerPubkey}:fips`).nonce,
            sessionId: "session-local",
            responderPubkey: peerPubkey,
            recipientPubkey: localPubkey,
            expiresAt: Math.floor(Date.now() / 1000) + 30,
            descriptor: {
                routeType: "fips",
                rooms: [room],
                expiresAt: Math.floor(Date.now() / 1000) + 30
            }
        })
    };
    mesh._publishEvent = event => signedEvents.push(event);
    mesh._signEvent = async event => ({...event, id: "event-id", sig: "sig", pubkey: localPubkey});
    mesh._trace = () => {};
    globalThis.meshdropFipsDiscovery = {
        joinRouteDescriptor(descriptor) {
            joined.push(descriptor);
            return true;
        }
    };

    try {
        await mesh._requestPrivateRoute({peerId: peerPubkey, recipientPubkey: peerPubkey, routeType: "fips"});
        assert.equal(encrypted.length, 1);
        assert.equal(encrypted[0].pubkey, peerPubkey);
        assert.equal(JSON.parse(encrypted[0].plaintext).type, "route-request");
        assert.equal(JSON.parse(encrypted[0].plaintext).routeType, "fips");
        assert.equal(signedEvents[0].tags.some(tag => tag[0] === "type" && tag[1] === "route-request"), true);
        assert.equal(signedEvents[0].tags.some(tag => tag[0] === "p" && tag[1] === peerPubkey), true);
        assert.equal(signedEvents[0].content, `ciphertext:${peerPubkey}`);

        await mesh._onRouteResponseEvent({pubkey: peerPubkey, content: "encrypted-response"});
        assert.deepEqual(joined.map(descriptor => descriptor.rooms), [[room]]);
        assert.equal(mesh._pendingRouteRequests.has(`${peerPubkey}:fips`), false);
    }
    finally {
        globalThis.meshdropFipsDiscovery = originalFips;
    }
});

test("Nostr mesh route responses reject nonce, recipient, and expiry mismatches", async () => {
    const localPubkey = "1".repeat(64);
    const peerPubkey = "2".repeat(64);
    const room = await globalThis.NpubNetworkProtocol.pairwiseRoom(localPubkey, peerPubkey);
    const joined = [];
    const originalFips = globalThis.meshdropFipsDiscovery;
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    mesh._identity = {pubkey: localPubkey};
    mesh._pendingRouteRequests = new Map([
        [`${peerPubkey}:fips`, {
            nonce: "expected",
            sessionId: "session-local",
            routeType: "fips",
            recipient: peerPubkey,
            expiresAt: Math.floor(Date.now() / 1000) + 30
        }]
    ]);
    mesh._identityController = {
        canNip44: () => true,
        decryptNip44From: async () => JSON.stringify({
            type: "route-response",
            routeType: "fips",
            nonce: "wrong",
            sessionId: "session-local",
            responderPubkey: peerPubkey,
            recipientPubkey: localPubkey,
            expiresAt: Math.floor(Date.now() / 1000) + 30,
            descriptor: {
                routeType: "fips",
                rooms: [room],
                expiresAt: Math.floor(Date.now() / 1000) + 30
            }
        })
    };
    mesh._trace = () => {};
    globalThis.meshdropFipsDiscovery = {
        joinRouteDescriptor(descriptor) {
            joined.push(descriptor);
            return true;
        }
    };

    try {
        await mesh._onRouteResponseEvent({pubkey: peerPubkey, content: "encrypted-response"});
        assert.deepEqual(joined, []);
        assert.equal(mesh._pendingRouteRequests.has(`${peerPubkey}:fips`), true);

        assert.equal(mesh._routeResponseDecision({pubkey: peerPubkey}, {
            type: "route-response",
            routeType: "fips",
            nonce: "expected",
            sessionId: "wrong-session",
            responderPubkey: peerPubkey,
            recipientPubkey: localPubkey,
            expiresAt: Math.floor(Date.now() / 1000) + 30,
            descriptor: {routeType: "fips", rooms: [room], expiresAt: Math.floor(Date.now() / 1000) + 30}
        }).reason, "session-mismatch");

        assert.equal(mesh._routeResponseDecision({pubkey: "3".repeat(64)}, {
            type: "route-response",
            routeType: "fips",
            nonce: "expected",
            sessionId: "session-local",
            responderPubkey: "3".repeat(64),
            recipientPubkey: localPubkey,
            expiresAt: Math.floor(Date.now() / 1000) + 30,
            descriptor: {routeType: "fips", rooms: [room], expiresAt: Math.floor(Date.now() / 1000) + 30}
        }).reason, "unsolicited-response");

        assert.equal(mesh._routeResponseDecision({pubkey: peerPubkey}, {
            type: "route-response",
            routeType: "fips",
            nonce: "expected",
            sessionId: "session-local",
            responderPubkey: peerPubkey,
            recipientPubkey: "3".repeat(64),
            expiresAt: Math.floor(Date.now() / 1000) + 30,
            descriptor: {routeType: "fips", rooms: [room], expiresAt: Math.floor(Date.now() / 1000) + 30}
        }).reason, "recipient-mismatch");

        assert.equal(mesh._routeResponseDecision({pubkey: peerPubkey}, {
            type: "route-response",
            routeType: "fips",
            nonce: "expected",
            sessionId: "session-local",
            responderPubkey: peerPubkey,
            recipientPubkey: localPubkey,
            expiresAt: Math.floor(Date.now() / 1000) - 1,
            descriptor: {routeType: "fips", rooms: [room], expiresAt: Math.floor(Date.now() / 1000) + 30}
        }).reason, "expired-descriptor");
    }
    finally {
        globalThis.meshdropFipsDiscovery = originalFips;
    }
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

test("Nostr mesh accepts trusted WOT presence and rejects untrusted events", () => {
    const followed = "a".repeat(64);
    const stranger = "b".repeat(64);
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    mesh._seenEvents = new Set();
    mesh._room = "";
    mesh._trustedPubkeys = new Set([followed]);
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
            ["client", "meshdrop"],
            ["capability", "meshdrop"],
            ["capability", "webrtc"]
        ]
    });

    assert.equal(mesh._shouldHandleEvent(event(followed)), true);
    assert.equal(mesh._shouldHandleEvent(event(stranger)), false);
    assert.equal(mesh._eventDecision(event(stranger)).reason, "untrusted-author");
    assert.equal(mesh._eventDecision({
        id: "route-detail",
        kind: globalThis.NostrMeshProtocol.kind,
        pubkey: followed,
        tags: [
            ["type", "route-detail"],
            ["p", mesh._identity.pubkey]
        ],
        content: JSON.stringify({fipsBase: "http://10.0.0.2:3000"})
    }).reason, "unsupported-type");
    assert.equal(mesh._eventDecision({
        id: "untrusted-route-response",
        kind: globalThis.NostrMeshProtocol.kind,
        pubkey: stranger,
        tags: [
            ["type", "route-response"],
            ["p", mesh._identity.pubkey]
        ],
        content: "ciphertext"
    }).reason, "untrusted-author");
    assert.equal(mesh._shouldHandleEvent({
        ...event(followed),
        tags: [["type", "connect"]]
    }), false);
});

test("Nostr mesh ignores presence from a different Nostr room", () => {
    const followed = "a".repeat(64);
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);
    mesh._seenEvents = new Set();
    mesh._room = "meshdrop";
    mesh._trustedPubkeys = new Set([followed]);
    mesh._identity = {
        pubkey: "c".repeat(64),
        followListStatus: "found",
        followPubkeys: [followed]
    };

    assert.equal(mesh._shouldHandleEvent({
        id: "event-id",
        kind: globalThis.NostrMeshProtocol.kind,
        pubkey: followed,
        tags: [
            ["type", "connect"],
            ["r", "other-room"],
            ["client", "meshdrop"],
            ["capability", "meshdrop"],
            ["capability", "webrtc"]
        ]
    }), false);
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

test("Nostr mesh user toggle stops signaling without removing existing RTC routes", async () => {
    const originalEvents = globalThis.Events;
    const originalLocalization = globalThis.Localization;
    const fired = [];
    const mesh = Object.create(globalThis.NostrMeshConnection.prototype);

    globalThis.Events = {
        fire(type, detail) {
            fired.push({type, detail});
        }
    };
    globalThis.Localization = {getTranslation: key => key};

    try {
        mesh._active = true;
        mesh._sockets = new Map();
        mesh._peers = new Set(["a".repeat(64)]);
        mesh._room = "mesh:meshdrop.test";
        mesh._publishPresence = () => {};
        mesh._stopPresenceHeartbeat = () => {};
        mesh._render = () => {};
        mesh._setPreferredActive = () => {};

        await mesh.toggle();

        assert.equal(mesh._active, false);
        assert.equal(fired.some(event => event.type === "peer-left"), false);
        assert.equal(mesh._peers.size, 0);
    }
    finally {
        globalThis.Events = originalEvents;
        globalThis.Localization = originalLocalization;
    }
});
