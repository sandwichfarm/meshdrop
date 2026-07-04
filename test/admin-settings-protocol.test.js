import test from "node:test";
import assert from "node:assert/strict";
import {finalizeEvent, generateSecretKey, getPublicKey, verifyEvent} from "nostr-tools";

await import("../public/scripts/admin-settings.js");

test("admin settings protocol gates shared-instance controls to the configured admin pubkey", () => {
    const pubkey = "a".repeat(64);
    const otherPubkey = "b".repeat(64);

    assert.equal(
        globalThis.AdminSettingsProtocol.canManageServerSettings(
            {admin: {enabled: true, pubkey}},
            {pubkey}
        ),
        true
    );
    assert.equal(
        globalThis.AdminSettingsProtocol.canManageServerSettings(
            {admin: {enabled: true, pubkey}},
            {pubkey: otherPubkey}
        ),
        false
    );
    assert.equal(
        globalThis.AdminSettingsProtocol.canManageServerSettings(
            {admin: {enabled: false, pubkey}},
            {pubkey}
        ),
        false
    );
});

test("admin settings protocol signs server-setting requests through the connected admin identity", async () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    globalThis.location = {origin: "https://meshdrop.test"};
    globalThis.meshdropNostrIdentity = {
        getIdentity: () => ({pubkey}),
        signEvent: async event => finalizeEvent(event, secretKey)
    };

    globalThis.AdminSettingsProtocol.setConfig({admin: {enabled: true, pubkey}});
    const body = await globalThis.AdminSettingsProtocol.signServerRequest("settings.fips.peers", {
        peers: [{npub: "npub1peer"}]
    });

    assert.equal(body.event.pubkey, pubkey);
    assert.equal(body.event.kind >= 0 && body.event.kind <= 9999, true);
    assert.deepEqual(JSON.parse(body.event.content), {
        action: "settings.fips.peers",
        peers: [{npub: "npub1peer"}]
    });
    assert.equal(body.event.tags.find(tag => tag[0] === "origin")?.[1], "https://meshdrop.test");
    assert.equal(verifyEvent(body.event), true);
});
