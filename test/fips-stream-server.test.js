import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {once} from "node:events";
import {Readable} from "node:stream";

import PairDropServer from "../server/server.js";
import FipsStreamTransferClient, {createFipsStreamConfig} from "../server/fips-stream-transfer.js";

const fipsStatus = {
    enabled: true,
    available: true,
    ipv6Addr: "fd12:3456:789a::1"
};

async function withTempClient(testBody, overrides = {}) {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "meshdrop-fips-stream-test-"));
    const client = new FipsStreamTransferClient({
        enabled: true,
        dir,
        maxUploadBytes: 1024,
        ttlMs: 60_000,
        ...overrides
    });

    try {
        await testBody(client, dir);
    } finally {
        await fs.promises.rm(dir, {recursive: true, force: true});
    }
}

async function withServer({status = fipsStatus, streamClient}, runTest) {
    const server = new PairDropServer({
        port: 0,
        rateLimit: false,
        debugMode: false,
        signalingServer: false,
        nostrMesh: {relays: []},
        blossom: {servers: []},
        pollen: {enabled: false, maxUploadBytes: 0},
        fips: {enabled: true, room: ""},
        federation: {pollen: {room: ""}},
        pollenClient: {status: async () => ({enabled: false, available: false})},
        fipsClient: {status: async () => status},
        fipsStreamClient: streamClient,
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

test("FIPS stream client stages token-bound downloads with SHA-256 metadata", async () => {
    await withTempClient(async client => {
        assert.deepEqual(await client.status(fipsStatus), {
            enabled: true,
            available: true,
            ipv6Addr: fipsStatus.ipv6Addr,
            primitive: "fips-http-stream",
            maxUploadBytes: 1024
        });

        const descriptor = await client.uploadStream(Readable.from(["hello"]), {
            size: 5,
            type: "text/plain"
        });

        assert.match(descriptor.id, /^[0-9a-f]{32}$/);
        assert.match(descriptor.token, /^[0-9a-f]{64}$/);
        assert.equal(descriptor.size, 5);
        assert.equal(descriptor.type, "text/plain");
        assert.equal(descriptor.sha256, crypto.createHash("sha256").update("hello").digest("hex"));
        assert.equal(Number.isFinite(descriptor.expiresAt), true);

        const download = await client.openDownload(descriptor.id, descriptor.token);
        assert.equal(await fs.promises.readFile(download.path, "utf8"), "hello");

        assert.throws(
            () => client.openDownload(descriptor.id, "0".repeat(64)),
            /invalid FIPS stream token/
        );
    });
});

test("FIPS stream client rejects unavailable FIPS and upload size overflow", async () => {
    await withTempClient(async client => {
        assert.deepEqual(await client.status({enabled: true, available: false}), {
            enabled: true,
            available: false,
            ipv6Addr: "",
            primitive: "fips-http-stream",
            maxUploadBytes: 3
        });

        await assert.rejects(
            client.uploadStream(Readable.from(["overflow"]), {size: 0, type: "text/plain"}),
            /size limit/
        );
    }, {maxUploadBytes: 3});
});

test("FIPS stream config defaults to enabled temp storage", () => {
    const config = createFipsStreamConfig({});

    assert.equal(config.enabled, true);
    assert.match(config.dir, /meshdrop-fips-stream/);
    assert.equal(config.maxUploadBytes, 2 * 1024 * 1024 * 1024);
    assert.equal(config.ttlMs, 10 * 60 * 1000);
    assert.equal(createFipsStreamConfig({FIPS_STREAM_TRANSFER: "false"}).enabled, false);
});

test("FIPS stream HTTP routes require available FIPS and serve CORS-readable bytes", async () => {
    await withTempClient(async streamClient => {
        await withServer({streamClient}, async baseUrl => {
            const statusResponse = await fetch(`${baseUrl}/fips/status`);
            const status = await statusResponse.json();

            assert.equal(status.streamTransfer.available, true);
            assert.equal(status.streamTransfer.ipv6Addr, fipsStatus.ipv6Addr);

            const upload = await fetch(`${baseUrl}/fips/upload`, {
                method: "POST",
                headers: {"Content-Type": "text/plain"},
                body: "hello"
            });
            const descriptor = await upload.json();

            assert.equal(upload.status, 200);
            assert.equal(descriptor.size, 5);
            assert.equal(descriptor.sha256, crypto.createHash("sha256").update("hello").digest("hex"));

            const download = await fetch(`${baseUrl}/fips/download/${descriptor.id}?token=${descriptor.token}`);

            assert.equal(download.status, 200);
            assert.equal(download.headers.get("access-control-allow-origin"), "*");
            assert.equal(await download.text(), "hello");

            const rejected = await fetch(`${baseUrl}/fips/download/${descriptor.id}?token=${"0".repeat(64)}`);
            assert.equal(rejected.status, 403);
        });
    });
});

test("FIPS instance relay proxy downloads remote FIPS bytes through the backend", async () => {
    await withTempClient(async streamClient => {
        const originalFetch = globalThis.fetch;
        const proxied = [];
        globalThis.fetch = async url => {
            proxied.push(String(url));
            return new Response("proxied", {
                status: 200,
                headers: {"Content-Type": "text/plain", "Content-Length": "7"}
            });
        };
        try {
            await withServer({streamClient}, async baseUrl => {
                const response = await originalFetch(`${baseUrl}/fips/proxy-download`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        baseUrl: "http://[fd12:3456:789a::1]:3000",
                        id: "a".repeat(32),
                        token: "b".repeat(64)
                    })
                });

                assert.equal(response.status, 200);
                assert.equal(response.headers.get("x-meshdrop-fips-proxy"), "instance");
                assert.equal(await response.text(), "proxied");
                assert.deepEqual(proxied, [
                    `http://[fd12:3456:789a::1]:3000/fips/download/${"a".repeat(32)}?token=${"b".repeat(64)}`
                ]);
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

test("FIPS instance relay proxy rejects non-FIPS targets", async () => {
    await withTempClient(async streamClient => {
        await withServer({streamClient}, async baseUrl => {
            const response = await fetch(`${baseUrl}/fips/proxy-download`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    baseUrl: "http://127.0.0.1:3000",
                    id: "a".repeat(32),
                    token: "b".repeat(64)
                })
            });
            const body = await response.json();

            assert.equal(response.status, 403);
            assert.match(body.error, /FIPS mesh URL/);
        });
    });
});

test("FIPS stream upload route fails closed when FIPS has no mesh address", async () => {
    await withTempClient(async streamClient => {
        await withServer({
            streamClient,
            status: {enabled: true, available: false, error: "offline"}
        }, async baseUrl => {
            const response = await fetch(`${baseUrl}/fips/upload`, {
                method: "POST",
                headers: {"Content-Type": "text/plain"},
                body: "hello"
            });
            const body = await response.json();

            assert.equal(response.status, 503);
            assert.match(body.error, /FIPS stream transfer is unavailable/);
        });
    });
});
