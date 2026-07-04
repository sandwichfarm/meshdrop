import test from "node:test";
import assert from "node:assert/strict";

import {createRuntimeCapabilities, createServerRuntimeConfig} from "../server/runtime-capabilities.js";

test("runtime capabilities describe backend transport support", () => {
    const capabilities = createRuntimeCapabilities({
        runtime: {target: "standalone"},
        signalingServer: false,
        fips: {enabled: true, room: "npub-network:fips"},
        pollen: {enabled: true, maxUploadBytes: 1024, room: "npub-network:pollen"},
        federation: {enabled: true},
        admin: {enabled: true}
    });

    assert.equal(capabilities.schemaVersion, 1);
    assert.equal(capabilities.runtime.target, "standalone");
    assert.equal(capabilities.runtime.hasBackend, true);
    assert.equal(capabilities.transports.webrtc.supported, true);
    assert.equal(capabilities.transports.localDiscovery.supported, true);
    assert.equal(capabilities.transports.fips.supported, true);
    assert.equal(capabilities.transports.fips.requiresBackend, true);
    assert.equal(capabilities.transports.fips.room, "npub-network:fips");
    assert.equal(capabilities.transports.pollen.supported, true);
    assert.equal(capabilities.transports.pollen.maxUploadBytes, 1024);
    assert.equal(capabilities.transports.bluetooth.supported, false);
    assert.equal(capabilities.transports.bluetooth.requiresNativeShell, true);
});

test("server runtime config reports the configured deployment target", () => {
    assert.deepEqual(createServerRuntimeConfig({}), {
        target: "standalone",
        platform: "server",
        hasBackend: true
    });
    assert.deepEqual(createServerRuntimeConfig({MESHDROP_TARGET: "umbrel"}), {
        target: "umbrel",
        platform: "server",
        hasBackend: true
    });
});

test("runtime capabilities gate signed server settings", () => {
    const withoutAdmin = createRuntimeCapabilities({
        runtime: {target: "standalone"},
        fips: {enabled: true},
        pollen: {enabled: false},
        admin: {enabled: false}
    });
    const withoutFips = createRuntimeCapabilities({
        runtime: {target: "standalone"},
        fips: {enabled: false},
        pollen: {enabled: false},
        admin: {enabled: true}
    });

    assert.equal(withoutAdmin.serverSettings.supported, false);
    assert.equal(withoutAdmin.serverSettings.actions.fipsPeers, false);
    assert.equal(withoutFips.serverSettings.supported, true);
    assert.equal(withoutFips.serverSettings.actions.fipsPeers, false);
});

test("runtime capabilities describe static SPA support without backend-only transports", () => {
    const capabilities = createRuntimeCapabilities({
        runtime: {
            target: "spa",
            platform: "browser",
            hasBackend: false
        },
        signalingServer: false,
        fips: {enabled: true, room: "npub-network:fips"},
        pollen: {enabled: true, maxUploadBytes: 1024},
        admin: {enabled: true}
    });

    assert.equal(capabilities.runtime.target, "spa");
    assert.equal(capabilities.runtime.platform, "browser");
    assert.equal(capabilities.runtime.hasBackend, false);
    assert.equal(capabilities.runtime.sharedInstance, false);
    assert.equal(capabilities.transports.webrtc.supported, true);
    assert.equal(capabilities.transports.nostr.supported, true);
    assert.equal(capabilities.transports.blossom.supported, true);
    assert.equal(capabilities.transports.hashtree.supported, true);
    assert.equal(capabilities.transports.localDiscovery.supported, false);
    assert.equal(capabilities.transports.fips.supported, false);
    assert.equal(capabilities.transports.pollen.supported, false);
    assert.equal(capabilities.transports.bluetooth.supported, false);
    assert.equal(capabilities.serverSettings.supported, false);
    assert.equal(capabilities.serverSettings.actions.fipsPeers, false);
});

test("runtime capabilities describe desktop source support without shared backend controls", () => {
    const capabilities = createRuntimeCapabilities({
        runtime: {
            target: "desktop",
            platform: "desktop",
            hasBackend: false
        },
        signalingServer: false,
        fips: {enabled: false},
        pollen: {enabled: false},
        admin: {enabled: false}
    });

    assert.equal(capabilities.runtime.target, "desktop");
    assert.equal(capabilities.runtime.platform, "desktop");
    assert.equal(capabilities.runtime.hasBackend, false);
    assert.equal(capabilities.runtime.sharedInstance, false);
    assert.equal(capabilities.transports.webrtc.supported, true);
    assert.equal(capabilities.transports.nostr.supported, true);
    assert.equal(capabilities.transports.blossom.supported, true);
    assert.equal(capabilities.transports.hashtree.supported, true);
    assert.equal(capabilities.transports.localDiscovery.supported, false);
    assert.equal(capabilities.transports.fips.supported, false);
    assert.equal(capabilities.transports.pollen.supported, false);
    assert.equal(capabilities.transports.bluetooth.supported, false);
    assert.equal(capabilities.serverSettings.supported, false);
});

test("runtime capabilities describe mobile source support without backend-only transports", () => {
    const capabilities = createRuntimeCapabilities({
        runtime: {
            target: "ios",
            platform: "mobile",
            hasBackend: false
        },
        signalingServer: false,
        fips: {enabled: false},
        pollen: {enabled: false},
        admin: {enabled: false}
    });

    assert.equal(capabilities.runtime.target, "ios");
    assert.equal(capabilities.runtime.platform, "mobile");
    assert.equal(capabilities.runtime.hasBackend, false);
    assert.equal(capabilities.runtime.sharedInstance, false);
    assert.equal(capabilities.transports.webrtc.supported, true);
    assert.equal(capabilities.transports.nostr.supported, true);
    assert.equal(capabilities.transports.blossom.supported, true);
    assert.equal(capabilities.transports.hashtree.supported, true);
    assert.equal(capabilities.transports.localDiscovery.supported, false);
    assert.equal(capabilities.transports.fips.supported, false);
    assert.equal(capabilities.transports.pollen.supported, false);
    assert.equal(capabilities.transports.bluetooth.supported, false);
    assert.equal(capabilities.transports.bluetooth.requiresNativeShell, true);
    assert.equal(capabilities.serverSettings.supported, false);
});
