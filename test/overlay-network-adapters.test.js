import test from "node:test";
import assert from "node:assert/strict";

import {
    buildOverlayNetworkDescriptor,
    createOverlayNetworkCapabilities,
    createOverlayNetworkConfig,
    overlayNetworkIds
} from "../server/overlay-network-adapters.js";

const OWNER = "b".repeat(64);
const NOW = 1_800_000_000_000;

test("overlay network config fails closed for unconfigured Tor I2P and Loki adapters", () => {
    const config = createOverlayNetworkConfig({});
    const capabilities = createOverlayNetworkCapabilities(config);

    assert.deepEqual(overlayNetworkIds, ["tor", "i2p", "loki"]);
    for (const routeType of overlayNetworkIds) {
        assert.equal(config[routeType].enabled, false);
        assert.equal(config[routeType].configured, false);
        assert.equal(capabilities[routeType].supported, false);
        assert.equal(capabilities[routeType].requiresBackend, true);
        assert.equal(capabilities[routeType].transportShape, "stream");
        assert.equal(capabilities[routeType].stream.supported, false);
        assert.equal(capabilities[routeType].stream.primitive, `${routeType}-http-stream`);
        assert.equal(capabilities[routeType].unavailableReason, "overlay-adapter-not-configured");
    }
});

test("overlay network config normalizes configured stream adapters through one catalog", () => {
    const config = createOverlayNetworkConfig({
        TOR_STREAM_ENDPOINT: "https://meshdropabcd.onion/meshdrop",
        TOR_STREAM_MAX_UPLOAD_BYTES: "4096",
        I2P_STREAM_ENDPOINT: "https://meshdropabcd.b32.i2p/meshdrop",
        LOKI_STREAM_ENDPOINT: "https://meshdropabcd.loki/meshdrop",
        LOKI_STREAM_MAX_UPLOAD_BYTES: "8192"
    });
    const capabilities = createOverlayNetworkCapabilities(config);

    assert.equal(config.tor.routeType, "tor");
    assert.equal(config.tor.streamEndpoint, "https://meshdropabcd.onion/meshdrop");
    assert.equal(config.tor.primitive, "tor-http-stream");
    assert.equal(config.tor.maxUploadBytes, 4096);
    assert.equal(capabilities.tor.supported, true);
    assert.equal(capabilities.tor.stream.supported, true);
    assert.equal(capabilities.tor.stream.primitive, "tor-http-stream");
    assert.equal(capabilities.tor.stream.endpointConfigured, true);
    assert.equal(capabilities.i2p.supported, true);
    assert.equal(capabilities.loki.supported, true);
    assert.equal(capabilities.loki.stream.maxUploadBytes, 8192);
});

test("overlay network config rejects clearnet endpoints for overlay adapters", () => {
    const config = createOverlayNetworkConfig({
        TOR_STREAM_ENDPOINT: "https://example.com/meshdrop",
        I2P_STREAM_ENDPOINT: "wss://meshdropabcd.i2p/meshdrop"
    });
    const capabilities = createOverlayNetworkCapabilities(config);

    assert.equal(config.tor.enabled, false);
    assert.equal(config.tor.unavailableReason, "overlay-adapter-invalid-endpoint");
    assert.equal(capabilities.tor.supported, false);
    assert.equal(capabilities.tor.unavailableReason, "overlay-adapter-invalid-endpoint");
    assert.equal(config.i2p.enabled, false);
    assert.equal(config.i2p.unavailableReason, "overlay-adapter-invalid-endpoint");
});

test("overlay network descriptor builder emits generic private stream descriptors", () => {
    const config = createOverlayNetworkConfig({
        TOR_STREAM_ENDPOINT: "https://meshdropabcd.onion/meshdrop"
    });

    assert.deepEqual(buildOverlayNetworkDescriptor(config.tor, {
        routeId: "tor-route-1",
        sessionId: "session-1",
        ownerPubkey: OWNER,
        expiresAt: NOW + 60_000
    }), {
        version: 1,
        routeId: "tor-route-1",
        routeType: "tor",
        transportShape: "stream",
        sessionId: "session-1",
        ownerPubkey: OWNER,
        expiresAt: NOW + 60_000,
        endpoint: {
            url: "https://meshdropabcd.onion/meshdrop",
            primitive: "tor-http-stream"
        },
        overlayIdentity: {
            network: "tor",
            destination: "meshdropabcd.onion"
        },
        constraints: {
            encrypted: true,
            private: true,
            failClosed: true
        },
        capabilities: {
            maxBytes: 2147483648,
            dataPlanePrimitive: "tor-http-stream"
        }
    });
});

test("overlay network descriptor builder rejects unsupported adapters", () => {
    const config = createOverlayNetworkConfig({});

    assert.throws(
        () => buildOverlayNetworkDescriptor(config.tor, {
            routeId: "tor-route-1",
            sessionId: "session-1",
            ownerPubkey: OWNER,
            expiresAt: NOW + 60_000
        }),
        /overlay-adapter-not-configured/
    );
});
