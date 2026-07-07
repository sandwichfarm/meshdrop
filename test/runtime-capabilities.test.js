import test from "node:test";
import assert from "node:assert/strict";

import {createRuntimeCapabilities, createServerRuntimeConfig} from "../server/runtime-capabilities.js";

function assertBluetoothNegotiatedUnsupported(bluetooth, {apiAvailable = false, nativeBridgeAvailable = false} = {}) {
    assert.equal(bluetooth.supported, false);
    assert.equal(bluetooth.transferSupported, false);
    assert.equal(bluetooth.requiresBackend, false);
    assert.equal(bluetooth.requiresNativeShell, false);
    assert.equal(bluetooth.apiAvailable, apiAvailable);
    assert.equal(bluetooth.nativeBridgeAvailable, nativeBridgeAvailable);
    assert.equal(bluetooth.requiresAdapter, true);
    assert.equal(bluetooth.unavailableReason, "bluetooth-transfer-not-implemented");
}

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
    assert.deepEqual(capabilities.transports.fips.relayIce, {
        supported: false,
        unavailableReason: "fips-relay-ice-not-configured"
    });
    assert.equal(capabilities.transports.pollen.supported, true);
    assert.equal(capabilities.transports.pollen.maxUploadBytes, 1024);
    assert.deepEqual(capabilities.transports.pollen.relayIce, {
        supported: false,
        unavailableReason: "pollen-relay-ice-not-configured"
    });
    assertBluetoothNegotiatedUnsupported(capabilities.transports.bluetooth);
});

test("runtime capabilities require TURN relay config before advertising overlay relay ICE", () => {
    const bare = createRuntimeCapabilities({
        runtime: {target: "standalone"},
        fips: {enabled: true, relayIce: {supported: true}},
        pollen: {enabled: true, relayIce: {supported: true}},
        admin: {enabled: false}
    });

    assert.deepEqual(bare.transports.fips.relayIce, {
        supported: false,
        unavailableReason: "fips-relay-ice-not-configured"
    });
    assert.deepEqual(bare.transports.pollen.relayIce, {
        supported: false,
        unavailableReason: "pollen-relay-ice-not-configured"
    });

    const configured = createRuntimeCapabilities({
        runtime: {target: "standalone"},
        fips: {
            enabled: true,
            relayIce: {
                supported: true,
                rtcConfig: {
                    iceServers: [{urls: "turn:fips-relay.test:3478", username: "fips", credential: "secret"}]
                }
            }
        },
        pollen: {
            enabled: true,
            relayIce: {
                supported: true,
                rtcConfig: {
                    iceServers: [{urls: ["stun:ignored.test:19302", "turns:pollen-relay.test:5349"]}]
                }
            }
        },
        admin: {enabled: false}
    });

    assert.deepEqual(configured.transports.fips.relayIce, {
        supported: true,
        rtcConfig: {
            iceServers: [{urls: "turn:fips-relay.test:3478", username: "fips", credential: "secret"}],
            iceTransportPolicy: "relay"
        }
    });
    assert.deepEqual(configured.transports.pollen.relayIce, {
        supported: true,
        rtcConfig: {
            iceServers: [{urls: ["turns:pollen-relay.test:5349"]}],
            iceTransportPolicy: "relay"
        }
    });
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
    assert.deepEqual(capabilities.transports.fips.relayIce, {
        supported: false,
        unavailableReason: "fips-relay-ice-not-configured"
    });
    assert.equal(capabilities.transports.pollen.supported, false);
    assert.deepEqual(capabilities.transports.pollen.relayIce, {
        supported: false,
        unavailableReason: "pollen-relay-ice-not-configured"
    });
    assertBluetoothNegotiatedUnsupported(capabilities.transports.bluetooth);
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
    assertBluetoothNegotiatedUnsupported(capabilities.transports.bluetooth);
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
    assertBluetoothNegotiatedUnsupported(capabilities.transports.bluetooth);
    assert.equal(capabilities.serverSettings.supported, false);
});

test("runtime capabilities negotiate Bluetooth adapters without claiming transfer support", () => {
    const capabilities = createRuntimeCapabilities({
        runtime: {
            target: "desktop",
            platform: "desktop",
            hasBackend: false
        },
        bluetooth: {
            apiAvailable: true,
            nativeBridgeAvailable: true
        }
    });

    assertBluetoothNegotiatedUnsupported(capabilities.transports.bluetooth, {
        apiAvailable: true,
        nativeBridgeAvailable: true
    });
});
