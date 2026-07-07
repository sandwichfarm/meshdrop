import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {finalizeEvent, generateSecretKey, getPublicKey} from "nostr-tools";

import {createAdminConfig} from "../server/admin-auth.js";
import {createOverlayNetworkConfig} from "../server/overlay-network-adapters.js";
import PairDropServer from "../server/server.js";

async function withServer(config, runTest) {
    const server = new PairDropServer({
        port: 0,
        rateLimit: false,
        debugMode: false,
        signalingServer: false,
        nostrMesh: {relays: []},
        blossom: {servers: []},
        pollen: {enabled: false, maxUploadBytes: 0},
        fips: {enabled: true, room: "npub-network:test"},
        federation: {pollen: {room: "npub-network:test"}},
        pollenClient: {status: async () => ({enabled: false})},
        fipsClient: config.fipsClient,
        overlayNetworks: config.overlayNetworks,
        admin: config.admin,
        buttons: {}
    });

    if (!server.server.listening) await once(server.server, "listening");

    try {
        const port = server.server.address().port;
        await runTest(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise(resolve => server.server.close(resolve));
    }
}

function signedAdminEvent(secretKey, request) {
    return finalizeEvent({
        kind: 8042,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["client", "meshdrop"]],
        content: JSON.stringify(request)
    }, secretKey);
}

test("/config exposes configured admin metadata", async () => {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);

    await withServer({
        admin: createAdminConfig({MESHDROP_ADMIN_NPUB: pubkey}),
        fipsClient: {status: async () => ({enabled: true}), savePeers: async () => ({})}
    }, async baseUrl => {
        const response = await fetch(`${baseUrl}/config`);
        const config = await response.json();

        assert.equal(config.admin.enabled, true);
        assert.equal(config.admin.pubkey, pubkey);
        assert.match(config.admin.npub, /^npub1/);
        assert.equal(config.capabilities.runtime.hasBackend, true);
        assert.equal(config.capabilities.serverSettings.actions.fipsPeers, true);
        assert.equal(config.capabilities.transports.tor.supported, false);
        assert.equal(config.capabilities.transports.tor.unavailableReason, "overlay-adapter-not-configured");
    });
});

test("/config exposes configured overlay stream adapter metadata", async () => {
    await withServer({
        admin: createAdminConfig({}),
        fipsClient: {status: async () => ({enabled: true}), savePeers: async () => ({})},
        overlayNetworks: createOverlayNetworkConfig({
            TOR_STREAM_ENDPOINT: "https://meshdropabcd.onion/meshdrop",
            TOR_STREAM_MAX_UPLOAD_BYTES: "4096"
        })
    }, async baseUrl => {
        const response = await fetch(`${baseUrl}/config`);
        const config = await response.json();

        assert.deepEqual(config.capabilities.transports.tor, {
            supported: true,
            requiresBackend: true,
            transportShape: "stream",
            stream: {
                supported: true,
                primitive: "tor-http-stream",
                endpointConfigured: true,
                maxUploadBytes: 4096
            }
        });
        assert.equal(config.capabilities.transports.i2p.supported, false);
        assert.equal(config.capabilities.transports.loki.supported, false);
    });
});

test("/settings/fips/peers requires a signed event from the configured admin", async () => {
    const secretKey = generateSecretKey();
    const savedPeers = [];

    await withServer({
        admin: createAdminConfig({MESHDROP_ADMIN_NPUB: getPublicKey(secretKey)}),
        fipsClient: {
            status: async () => ({enabled: true}),
            savePeers: async peers => {
                savedPeers.push(peers);
                return {peers, restart: {available: true}};
            }
        }
    }, async baseUrl => {
        const rejected = await fetch(`${baseUrl}/settings/fips/peers`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({peers: []})
        });
        assert.equal(rejected.status, 403);

        const request = {
            action: "settings.fips.peers",
            peers: [{npub: "npub1peer", transport: "tcp", address: "203.0.113.9:2121"}]
        };
        const accepted = await fetch(`${baseUrl}/settings/fips/peers`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({event: signedAdminEvent(secretKey, request)})
        });
        const result = await accepted.json();

        assert.equal(accepted.status, 200);
        assert.deepEqual(savedPeers, [request.peers]);
        assert.equal(result.restart.available, true);
    });
});
