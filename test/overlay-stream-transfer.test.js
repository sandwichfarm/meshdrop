import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {once} from "node:events";
import {Readable} from "node:stream";

import {createOverlayNetworkConfig} from "../server/overlay-network-adapters.js";
import OverlayStreamTransferClient, {createOverlayStreamClients} from "../server/overlay-stream-transfer.js";
import PairDropServer from "../server/server.js";

const torConfig = createOverlayNetworkConfig({
    TOR_STREAM_ENDPOINT: "http://meshdropabcd.onion/overlay/tor",
    TOR_STREAM_MAX_UPLOAD_BYTES: "1024"
}).tor;

async function withTempClient(testBody, overrides = {}) {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "meshdrop-overlay-stream-test-"));
    const client = new OverlayStreamTransferClient({
        ...torConfig,
        dir,
        ttlMs: 60_000,
        ...overrides
    });

    try {
        await testBody(client, dir);
    } finally {
        await fs.promises.rm(dir, {recursive: true, force: true});
    }
}

async function withServer({overlayNetworks = {tor: torConfig}, overlayStreamClients}, runTest) {
    const server = new PairDropServer({
        port: 0,
        rateLimit: false,
        debugMode: false,
        signalingServer: false,
        nostrMesh: {relays: []},
        blossom: {servers: []},
        pollen: {enabled: false, maxUploadBytes: 0},
        fips: {enabled: false, room: ""},
        federation: {pollen: {room: ""}},
        pollenClient: {status: async () => ({enabled: false, available: false})},
        fipsClient: {status: async () => ({enabled: false, available: false})},
        fipsStreamClient: {status: async () => ({enabled: false, available: false})},
        overlayNetworks,
        overlayStreamClients,
        admin: {enabled: false},
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

test("overlay stream client stages token-bound Tor downloads with route metadata", async () => {
    await withTempClient(async client => {
        assert.deepEqual(await client.status(), {
            enabled: true,
            available: true,
            routeType: "tor",
            primitive: "tor-http-stream",
            destination: "meshdropabcd.onion",
            streamEndpoint: "http://meshdropabcd.onion/overlay/tor",
            maxUploadBytes: 1024
        });

        const descriptor = await client.uploadStream(Readable.from(["hello"]), {
            size: 5,
            type: "text/plain"
        });

        assert.match(descriptor.id, /^[0-9a-f]{32}$/);
        assert.match(descriptor.token, /^[0-9a-f]{64}$/);
        assert.equal(descriptor.routeType, "tor");
        assert.equal(descriptor.primitive, "tor-http-stream");
        assert.equal(descriptor.destination, "meshdropabcd.onion");
        assert.equal(descriptor.size, 5);
        assert.equal(descriptor.type, "text/plain");
        assert.equal(descriptor.sha256, crypto.createHash("sha256").update("hello").digest("hex"));
        assert.equal(descriptor.downloadUrl, "http://meshdropabcd.onion/overlay/tor/download/" + descriptor.id);

        const download = client.openDownload(descriptor.id, descriptor.token);
        assert.equal(await fs.promises.readFile(download.path, "utf8"), "hello");
        assert.throws(
            () => client.openDownload(descriptor.id, "0".repeat(64)),
            /invalid overlay stream token/
        );
    });
});

test("overlay stream client fails closed when route is not configured", async () => {
    const disabled = {
        ...createOverlayNetworkConfig({}).tor,
        maxUploadBytes: 1024
    };
    await withTempClient(async client => {
        assert.deepEqual(await client.status(), {
            enabled: false,
            available: false,
            routeType: "tor",
            primitive: "tor-http-stream",
            destination: "",
            streamEndpoint: "",
            maxUploadBytes: 1024,
            unavailableReason: "overlay-adapter-not-configured"
        });
        await assert.rejects(
            client.uploadStream(Readable.from(["hello"]), {size: 5, type: "text/plain"}),
            /overlay stream transfer is unavailable/
        );
    }, disabled);
});

test("overlay stream HTTP routes upload and serve configured Tor bytes", async () => {
    await withTempClient(async torClient => {
        await withServer({
            overlayStreamClients: {tor: torClient}
        }, async baseUrl => {
            const statusResponse = await fetch(`${baseUrl}/overlay/tor/status`);
            const status = await statusResponse.json();
            assert.equal(status.available, true);
            assert.equal(status.destination, "meshdropabcd.onion");

            const upload = await fetch(`${baseUrl}/overlay/tor/upload`, {
                method: "POST",
                headers: {"Content-Type": "text/plain"},
                body: "hello"
            });
            const descriptor = await upload.json();

            assert.equal(upload.status, 200);
            assert.equal(descriptor.routeType, "tor");
            assert.equal(descriptor.sha256, crypto.createHash("sha256").update("hello").digest("hex"));

            const download = await fetch(`${baseUrl}/overlay/tor/download/${descriptor.id}?token=${descriptor.token}`);
            assert.equal(download.status, 200);
            assert.equal(download.headers.get("access-control-allow-origin"), "*");
            assert.equal(await download.text(), "hello");

            const rejected = await fetch(`${baseUrl}/overlay/tor/download/${descriptor.id}?token=${"0".repeat(64)}`);
            assert.equal(rejected.status, 403);
        });
    });
});

test("overlay stream HTTP routes reject unknown or unavailable overlays", async () => {
    await withServer({
        overlayNetworks: createOverlayNetworkConfig({}),
        overlayStreamClients: createOverlayStreamClients(createOverlayNetworkConfig({}))
    }, async baseUrl => {
        const unknown = await fetch(`${baseUrl}/overlay/quantum/status`);
        assert.equal(unknown.status, 404);

        const unavailable = await fetch(`${baseUrl}/overlay/tor/upload`, {
            method: "POST",
            body: "hello"
        });
        assert.equal(unavailable.status, 503);
    });
});
