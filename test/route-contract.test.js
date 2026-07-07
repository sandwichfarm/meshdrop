import test from "node:test";
import assert from "node:assert/strict";

await import("../public/scripts/route-contract.js");

const contract = globalThis.MeshDropRouteContract;
const NOW = 1_800_000_000_000;
const OWNER = "a".repeat(64);

const privateFipsDescriptor = overrides => ({
    version: 1,
    routeId: "route-session-local",
    routeType: "fips",
    transportShape: "stream",
    sessionId: "session-1",
    ownerPubkey: OWNER,
    expiresAt: NOW + 60_000,
    endpoint: {
        address: "fd00::1234",
        port: 443,
        protocol: "https"
    },
    overlayIdentity: {
        fipsNpub: "npub1fipsroute"
    },
    constraints: {
        encrypted: true,
        private: true
    },
    capabilities: {
        maxBytes: 1048576
    },
    ...overrides
});

test("normalizes a valid route descriptor for a private overlay route", () => {
    const result = contract.validateDescriptor(privateFipsDescriptor(), {
        now: NOW,
        expectedOwnerPubkey: OWNER,
        expectedSessionId: "session-1"
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.descriptor, privateFipsDescriptor());
});

test("represents legacy room descriptors without changing live route behavior", () => {
    const result = contract.validateLegacyRoomDescriptor({
        routeType: "fips",
        rooms: ["npub-network:alice", "npub-network:alice"],
        expiresAt: NOW + 60_000
    }, {
        now: NOW,
        expectedRouteType: "fips",
        expectedOwnerPubkey: OWNER,
        expectedSessionId: "session-1"
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.descriptor, {
        version: 1,
        routeId: "legacy-room:fips:session-1",
        routeType: "fips",
        transportShape: "instance-relay",
        sessionId: "session-1",
        ownerPubkey: OWNER,
        expiresAt: NOW + 60_000,
        endpoint: {
            rooms: ["npub-network:alice"]
        },
        overlayIdentity: {},
        constraints: {
            encrypted: true,
            private: true
        },
        capabilities: {
            legacyRooms: true
        }
    });
});

test("rejects invalid expired or wrongly bound route descriptors", () => {
    const context = {
        now: NOW,
        expectedOwnerPubkey: OWNER,
        expectedSessionId: "session-1"
    };

    const cases = [
        ["missing route type", {routeType: ""}, "missing-route-type"],
        ["unsupported transport shape", {transportShape: "quantum-tunnel"}, "unsupported-transport-shape"],
        ["expired descriptor", {expiresAt: NOW}, "expired"],
        ["wrong owner", {ownerPubkey: "b".repeat(64)}, "owner-mismatch"],
        ["wrong session", {sessionId: "session-2"}, "session-mismatch"]
    ];

    for (const [name, overrides, reason] of cases) {
        assert.deepEqual(
            contract.validateDescriptor(privateFipsDescriptor(overrides), context),
            {ok: false, reason},
            name
        );
    }
});

test("validates route adapter method surface and availability state", () => {
    const adapter = {
        status() {
            return {supported: true, available: false, reason: "missing fips daemon"};
        },
        capabilities() {
            return [{routeType: "fips", transportShape: "stream"}];
        },
        descriptorFor() {},
        acceptDescriptor() {},
        send() {},
        receive() {},
        close() {},
        proof() {}
    };

    assert.deepEqual(contract.validateAdapter(adapter), {
        ok: true,
        availability: "unavailable",
        reason: "missing fips daemon",
        capabilities: [{routeType: "fips", transportShape: "stream"}],
        methods: [
            "status",
            "capabilities",
            "descriptorFor",
            "acceptDescriptor",
            "send",
            "receive",
            "close",
            "proof"
        ]
    });

    assert.deepEqual(
        contract.validateAdapter({...adapter, proof: undefined}),
        {ok: false, reason: "missing-method:proof"}
    );
});

test("scores trusted private routes without changing live signaling priority", () => {
    const ranked = contract.rankCandidates([
        {
            routeId: "public-clearnet",
            routeType: "nostr",
            transportShape: "stream",
            available: true,
            trusted: false,
            private: false,
            encrypted: true,
            relayCost: 0
        },
        {
            routeId: "private-fips",
            routeType: "fips",
            transportShape: "stream",
            available: true,
            trusted: true,
            private: true,
            encrypted: true,
            relayCost: 2
        },
        {
            routeId: "connected-direct",
            routeType: "webrtc",
            transportShape: "stream",
            connected: true,
            available: true,
            trusted: true,
            private: true,
            encrypted: true,
            relayCost: 0
        }
    ]);

    assert.equal(ranked[0].routeId, "connected-direct");
    assert.equal(ranked[1].routeId, "private-fips");
    assert.equal(ranked[2].routeId, "public-clearnet");
    assert.deepEqual(ranked[1].reasons, [
        "available",
        "trusted",
        "private",
        "encrypted",
        "relay-cost:2"
    ]);
});

test("validates route proof fields for claimed byte transport", () => {
    const proof = {
        senderRuntime: "docker-a",
        recipientRuntime: "docker-b",
        routeType: "fips",
        dataPlanePrimitive: "fips-stream",
        webRtcUsed: false,
        instanceRelayed: true,
        bytesSent: 4096,
        bytesReceived: 4096,
        hashMatched: true,
        fallbackUsed: false
    };

    assert.deepEqual(contract.validateRouteProof(proof), {
        ok: true,
        proof
    });
    assert.deepEqual(
        contract.validateRouteProof({...proof, hashMatched: false}),
        {ok: false, reason: "hash-mismatch"}
    );
    assert.deepEqual(
        contract.validateRouteProof({...proof, fallbackUsed: true}),
        {ok: false, reason: "fallback-used"}
    );
});
