import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

if (!globalThis.btoa) {
    globalThis.btoa = value => Buffer.from(value, "binary").toString("base64");
}

globalThis.$ = () => null;
globalThis.Events = {on() {}, fire() {}};
globalThis.Localization = {getTranslation(key) { return key; }};

await import("../public/scripts/blossom-transfer.js");
await import("../public/scripts/hashtree-transfer.js");

const protocol = globalThis.HashtreeTransferProtocol;

test("Hashtree protocol encodes HTS-01 file nodes deterministically", async () => {
    const node = protocol.encodeNode(protocol.fileType, [{
        hash: "00".repeat(32),
        size: 5,
        type: protocol.blobLinkType
    }]);

    assert.equal(
        BlossomTransferProtocol.bytesToHex(node),
        "82a16c9183a168c4200000000000000000000000000000000000000000000000000000000000000000a17305a17400a17401"
    );
    assert.equal(
        await protocol.sha256Hex(node),
        "576537dba01dc47bfd54dde01b25210bc62bc12bf3bbd5d2a6e8a96d9ba9a3e0"
    );
});

test("Hashtree protocol decodes generated file nodes", () => {
    const node = protocol.decodeNode(protocol.encodeNode(protocol.fileType, [{
        hash: "11".repeat(32),
        size: 7,
        type: protocol.blobLinkType
    }]));

    assert.equal(node.t, protocol.fileType);
    assert.equal(node.l.length, 1);
    assert.equal(BlossomTransferProtocol.bytesToHex(node.l[0].h), "11".repeat(32));
    assert.equal(node.l[0].s, 7);
    assert.equal(node.l[0].t, protocol.blobLinkType);
});

test("Hashtree controller builds and downloads a verified multi-file tree", async () => {
    const storedObjects = new Map();

    globalThis.meshdropBlossomTransfer = {
        _serverUrls() {
            return ["https://blossom.test"];
        },
        async uploadFile(blob) {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const sha256 = await protocol.sha256Hex(bytes);
            storedObjects.set(sha256, bytes);
            return {
                url: `https://blossom.test/${sha256}`,
                sha256,
                size: bytes.length,
                type: blob.type || "application/octet-stream",
                uploaded: 1000
            };
        }
    };

    globalThis.fetch = async url => {
        const hash = String(url).split("/").pop();
        const bytes = storedObjects.get(hash);
        if (!bytes) return new Response("", {status: 404});
        return new Response(bytes);
    };

    const controller = new globalThis.HashtreeTransferController();
    const files = [
        new File(["hello"], "a.txt", {type: "text/plain"}),
        new File(["world"], "b.txt", {type: "text/plain"})
    ];
    const manifest = await controller.uploadFiles(files);
    const downloaded = await controller.downloadFiles(manifest, [
        {name: "a.txt", mime: "text/plain", size: 5},
        {name: "b.txt", mime: "text/plain", size: 5}
    ]);

    assert.equal(manifest.version, "HTS-01");
    assert.equal(manifest.files.length, 2);
    assert.equal(Object.keys(manifest.objects).length, 5);
    assert.equal(await downloaded[0].text(), "hello");
    assert.equal(await downloaded[1].text(), "world");
});

test("Hashtree manifest validation rejects file metadata mismatches", () => {
    assert.throws(
        () => protocol.validateManifest({
            version: "HTS-01",
            root: {hash: "11".repeat(32)},
            objects: {},
            files: [{name: "a.txt", size: 1, hash: "22".repeat(32)}]
        }, [{name: "b.txt", size: 1}]),
        /metadata mismatch/
    );
});
