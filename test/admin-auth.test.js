import test from "node:test";
import assert from "node:assert/strict";
import {finalizeEvent, generateSecretKey, getPublicKey, nip19} from "nostr-tools";

import {
    createAdminConfig,
    verifySignedAdminRequest
} from "../server/admin-auth.js";

function signedRequest(secretKey, request, overrides = {}) {
    return finalizeEvent({
        kind: overrides.kind ?? 3817,
        created_at: overrides.createdAt ?? 1234567890,
        tags: [["client", "meshdrop"]],
        content: JSON.stringify(request)
    }, secretKey);
}

test("admin config accepts npub and exposes the normalized admin pubkey", () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const config = createAdminConfig({MESHDROP_ADMIN_NPUB: nip19.npubEncode(pubkey)});

    assert.deepEqual(config, {
        enabled: true,
        pubkey,
        npub: nip19.npubEncode(pubkey)
    });
});

test("signed admin request accepts only the configured admin event", () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    const config = createAdminConfig({MESHDROP_ADMIN_NPUB: pubkey});
    const request = {
        action: "settings.fips.peers",
        peers: [{npub: "npub1peer", transport: "tcp", address: "203.0.113.9:2121"}]
    };

    const result = verifySignedAdminRequest(config, signedRequest(secretKey, request), {
        now: 1234567890
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.request, request);
});

test("signed admin request rejects unconfigured, wrong signer, invalid kind, and tampered content", () => {
    const adminSecret = generateSecretKey();
    const otherSecret = generateSecretKey();
    const config = createAdminConfig({MESHDROP_ADMIN_NPUB: getPublicKey(adminSecret)});
    const request = {action: "settings.fips.peers", peers: []};

    assert.equal(
        verifySignedAdminRequest(createAdminConfig({}), signedRequest(adminSecret, request)).error,
        "admin_not_configured"
    );

    assert.equal(
        verifySignedAdminRequest(config, signedRequest(otherSecret, request)).error,
        "admin_pubkey_mismatch"
    );

    assert.equal(
        verifySignedAdminRequest(config, signedRequest(adminSecret, request, {kind: 10000})).error,
        "admin_kind_out_of_range"
    );

    const tampered = signedRequest(adminSecret, request);
    tampered.content = JSON.stringify({...request, peers: [{npub: "npub1tampered"}]});

    assert.equal(
        verifySignedAdminRequest(config, tampered).error,
        "admin_event_invalid"
    );
});
