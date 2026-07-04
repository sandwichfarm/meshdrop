import test from "node:test";
import assert from "node:assert/strict";
import {finalizeEvent, generateSecretKey, getPublicKey, verifyEvent} from "nostr-tools";

await import("../public/scripts/runtime-capabilities.js");
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
    assert.equal(
        globalThis.AdminSettingsProtocol.canManageServerSettings(
            {
                admin: {enabled: true, pubkey},
                capabilities: {serverSettings: {supported: true, actions: {fipsPeers: false}}}
            },
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

test("admin settings protocol re-hides the FIPS tab after dialog render mutations", () => {
    const fipsTab = fakeElement(["selected"]);
    const fipsPanel = fakeElement();
    const blossomTab = fakeElement();
    let mutationCallback = null;

    globalThis.document = {
        querySelector(selector) {
            if (selector === '[data-settings-tab="fips"]') return fipsTab;
            if (selector === '[data-settings-panel="fips"]') return fipsPanel;
            if (selector === '[data-settings-tab="blossom"]') return blossomTab;
            return null;
        }
    };
    globalThis.MutationObserver = class {
        constructor(callback) {
            mutationCallback = callback;
        }

        observe() {}
    };
    globalThis.AdminSettingsProtocol._observerBound = false;
    globalThis.AdminSettingsProtocol.observeServerSettings();
    globalThis.AdminSettingsProtocol.setConfig({
        admin: {enabled: false},
        capabilities: {serverSettings: {supported: false, actions: {fipsPeers: false}}}
    });

    assert.equal(fipsTab.hasAttribute("hidden"), true);

    fipsTab.toggleAttribute("hidden", false);
    mutationCallback();

    assert.equal(fipsTab.hasAttribute("hidden"), true);
    assert.equal(fipsPanel.hasAttribute("hidden"), true);
    assert.equal(blossomTab.clicked, true);

    delete globalThis.document;
    delete globalThis.MutationObserver;
});

function fakeElement(classes = []) {
    const attributes = new Set();
    const classSet = new Set(classes);
    return {
        clicked: false,
        classList: {
            contains(name) {
                return classSet.has(name);
            }
        },
        toggleAttribute(name, force) {
            if (force) attributes.add(name);
            else attributes.delete(name);
        },
        hasAttribute(name) {
            return attributes.has(name);
        },
        click() {
            this.clicked = true;
        }
    };
}
