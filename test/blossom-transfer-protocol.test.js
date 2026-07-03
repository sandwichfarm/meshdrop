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
const storage = new Map();

globalThis.localStorage = {
    getItem(key) {
        return storage.get(key) || null;
    },
    setItem(key, value) {
        storage.set(key, value);
    }
};

await import("../public/scripts/nostr-relays.js");
await import("../public/scripts/blossom-transfer.js");

const protocol = globalThis.BlossomTransferProtocol;

test("Blossom protocol trims configured server URLs", () => {
    assert.deepEqual(
        protocol.serverUrlsFromConfig({blossom: {servers: [" https://cdn.example/ ", "", "http://127.0.0.1:8080//"]}}),
        ["https://cdn.example", "http://127.0.0.1:8080"]
    );
});

test("Blossom controller uses enabled outbox-discovered servers", () => {
    storage.clear();
    const originalIdentity = globalThis.meshdropNostrIdentity;
    globalThis.meshdropNostrIdentity = {
        getIdentity() {
            return {blossomServers: ["https://outbox.blossom", "https://disabled.blossom"]};
        }
    };

    try {
        const controller = new globalThis.BlossomTransferController();
        controller._config = {blossom: {servers: ["https://configured.blossom"]}};
        globalThis.ProtocolServerPreferences.setProtocolEnabled("https://disabled.blossom", "blossom", false);

        assert.deepEqual(controller._serverUrls(), ["https://outbox.blossom"]);
    } finally {
        globalThis.meshdropNostrIdentity = originalIdentity;
    }
});

test("Blossom protocol hashes blobs with SHA-256", async () => {
    assert.equal(
        await protocol.sha256Hex(new Blob(["hello"])),
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
});

test("Blossom protocol creates BUD-11 upload authorization drafts", () => {
    const draft = protocol.createUploadAuthDraft({
        serverUrl: "https://Blossom.Example/upload",
        sha256: "a".repeat(64),
        now: 1000
    });

    assert.equal(draft.kind, 24242);
    assert.equal(draft.created_at, 1000);
    assert.deepEqual(draft.tags, [
        ["t", "upload"],
        ["expiration", "1600"],
        ["server", "blossom.example"],
        ["x", "a".repeat(64)]
    ]);
    assert.equal(draft.content, "Upload Blob");
});

test("Blossom protocol encodes Nostr authorization without base64 padding", () => {
    const header = protocol.authorizationHeader({kind: 24242, content: "Upload Blob"});

    assert.match(header, /^Nostr [A-Za-z0-9_-]+$/);
    assert.equal(header.includes("="), false);
});

test("Blossom protocol validates descriptors against uploaded file metadata", () => {
    const file = new Blob(["hello"], {type: "text/plain"});
    const descriptor = protocol.validateDescriptor({
        url: "https://cdn.example/hello.txt",
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        size: 5,
        type: "text/plain",
        uploaded: 1000
    }, file, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");

    assert.deepEqual(descriptor, {
        url: "https://cdn.example/hello.txt",
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        size: 5,
        type: "text/plain",
        uploaded: 1000
    });
});

test("Blossom protocol rejects descriptor hash and size mismatches", () => {
    const file = new Blob(["hello"], {type: "text/plain"});

    assert.throws(
        () => protocol.validateDescriptor({url: "https://cdn.example/hello.txt", sha256: "bad", size: 5}, file, "good"),
        /hash mismatch/
    );
    assert.throws(
        () => protocol.validateDescriptor({url: "https://cdn.example/hello.txt", sha256: "good", size: 6}, file, "good"),
        /size mismatch/
    );
});
