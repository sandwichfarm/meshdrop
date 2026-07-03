import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {finalizeEvent, generateSecretKey, getPublicKey} from "nostr-tools/pure";
import Peer from "../server/peer.js";
import {
    MESH_DROP_NOSTR_AUTH_CONTENT,
    MESH_DROP_NOSTR_AUTH_KIND,
    verifyNostrIdentity
} from "../server/nostr-identity.js";

function signedIdentity({
    origin = "https://meshdrop.test",
    displayName = "npub test",
    createdAt = Math.floor(Date.now() / 1000)
} = {}) {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const event = finalizeEvent({
        kind: MESH_DROP_NOSTR_AUTH_KIND,
        created_at: createdAt,
        tags: [
            ["client", "meshdrop"],
            ["origin", origin],
            ["name", displayName]
        ],
        content: MESH_DROP_NOSTR_AUTH_CONTENT
    }, secretKey);

    return {
        pubkey,
        displayName,
        raw: JSON.stringify({pubkey, displayName, event}),
        now: createdAt,
        origin
    };
}

test("signed Nostr identity verifies and exposes display metadata", () => {
    const identity = signedIdentity({displayName: "Alice Nostr"});

    const verified = verifyNostrIdentity(identity.raw, {
        now: identity.now,
        origin: identity.origin
    });

    assert.equal(verified.pubkey, identity.pubkey);
    assert.equal(verified.displayName, "Alice Nostr");
    assert.equal(verified.verified, true);
    assert.match(verified.npub, /^npub1/);
});

test("Nostr identity rejects origin mismatch", () => {
    const identity = signedIdentity();

    const verified = verifyNostrIdentity(identity.raw, {
        now: identity.now,
        origin: "https://evil.test"
    });

    assert.equal(verified, null);
});

test("Nostr identity rejects tampered signed display names", () => {
    const identity = signedIdentity();
    const tampered = JSON.parse(identity.raw);
    tampered.event.tags = tampered.event.tags.map(tag => {
        return tag[0] === "name" ? ["name", "Mallory"] : tag;
    });

    const verified = verifyNostrIdentity(JSON.stringify(tampered), {
        now: identity.now,
        origin: identity.origin
    });

    assert.equal(verified, null);
});

test("Nostr identity ignores unsigned wrapper display names", () => {
    const identity = signedIdentity({displayName: "Alice Nostr"});
    const tampered = JSON.parse(identity.raw);
    tampered.displayName = "Mallory";

    const verified = verifyNostrIdentity(JSON.stringify(tampered), {
        now: identity.now,
        origin: identity.origin
    });

    assert.equal(verified.displayName, "Alice Nostr");
});

test("peer keeps generated fallback name when no Nostr identity is supplied", () => {
    const peer = new Peer(
        {send() {}, terminate() {}},
        {
            url: "/server?webrtc_supported=true",
            headers: {"user-agent": "node:test"},
            socket: {remoteAddress: "203.0.113.10"},
            connection: {remoteAddress: "203.0.113.10"}
        },
        {ipv6Localize: 0, debugMode: false}
    );

    assert.equal(peer.nostrIdentity, null);
    assert.match(peer.name.displayName, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
});

test("peer id generation falls back when crypto.randomUUID is unavailable", () => {
    const originalRandomUuid = crypto.randomUUID;
    crypto.randomUUID = undefined;

    try {
        const peer = new Peer(
            {send() {}, terminate() {}},
            {
                url: "/server?webrtc_supported=true",
                headers: {"user-agent": "node:test"},
                socket: {remoteAddress: "203.0.113.10"},
                connection: {remoteAddress: "203.0.113.10"}
            },
            {ipv6Localize: 0, debugMode: false}
        );

        assert.match(peer.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
        crypto.randomUUID = originalRandomUuid;
    }
});

test("peer uses verified Nostr identity as display name", () => {
    const identity = signedIdentity({displayName: "Alice Nostr"});
    const peer = new Peer(
        {send() {}, terminate() {}},
        {
            url: `/server?webrtc_supported=true&nostr_identity=${encodeURIComponent(identity.raw)}`,
            headers: {
                "user-agent": "node:test",
                origin: identity.origin
            },
            socket: {remoteAddress: "203.0.113.10"},
            connection: {remoteAddress: "203.0.113.10"}
        },
        {ipv6Localize: 0, debugMode: false}
    );

    assert.equal(peer.nostrIdentity.pubkey, identity.pubkey);
    assert.equal(peer.name.displayName, "Alice Nostr");
});
