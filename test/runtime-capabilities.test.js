import test from "node:test";
import assert from "node:assert/strict";

import {createRuntimeCapabilities} from "../server/runtime-capabilities.js";

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
