import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

if (!globalThis.btoa) {
    globalThis.btoa = value => Buffer.from(value, "binary").toString("base64");
}

if (!globalThis.atob) {
    globalThis.atob = value => Buffer.from(value, "base64").toString("binary");
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

async function installBlossomFallbacks() {
    const originalAesGcmFallback = globalThis.meshdropBlossomAesGcmFallback;
    const originalSha256Fallback = globalThis.meshdropBlossomSha256Fallback;

    globalThis.meshdropBlossomAesGcmFallback = async () => {
        const module = await import("../public/scripts/libs/noble-ciphers/aes.js");
        return module.gcm;
    };
    globalThis.meshdropBlossomSha256Fallback = async () => {
        const module = await import("../public/scripts/libs/noble-hashes/sha2.js");
        return module.sha256;
    };

    return () => {
        globalThis.meshdropBlossomAesGcmFallback = originalAesGcmFallback;
        globalThis.meshdropBlossomSha256Fallback = originalSha256Fallback;
    };
}

async function withNoSubtleCrypto(callback) {
    const originalCrypto = globalThis.crypto;
    const restoreFallbacks = await installBlossomFallbacks();

    Object.defineProperty(globalThis, "crypto", {
        value: {getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto)},
        configurable: true
    });

    try {
        return await callback();
    } finally {
        restoreFallbacks();
        Object.defineProperty(globalThis, "crypto", {
            value: originalCrypto,
            configurable: true
        });
    }
}

async function createEncryptedBlossomFixture({plaintext = "hello", header = null} = {}) {
    const fileHeader = header || {name: "secret.txt", mime: "text/plain", size: plaintext.length};
    const contentKey = await protocol.generateContentKey();
    const rawKey = await protocol.exportContentKey(contentKey);
    const transferId = protocol.createTransferId();
    const encrypted = await protocol.encryptFile(new File([plaintext], fileHeader.name, {type: fileHeader.mime}), contentKey, {
        transferId,
        index: 0,
        header: fileHeader
    });
    const sha256 = await protocol.sha256Hex(encrypted.blob);

    return {
        contentKey,
        rawKey,
        header: fileHeader,
        encrypted,
        descriptor: {
            url: "https://blossom.test/ciphertext",
            sha256,
            size: encrypted.blob.size,
            type: "application/octet-stream",
            uploaded: 1000
        },
        envelope: {
            version: protocol.encryptionVersion,
            algorithm: protocol.contentAlgorithm,
            transferId,
            files: [encrypted.envelope]
        }
    };
}

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

test("Blossom protocol fails closed with clear Web Crypto error", async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
        value: {getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto)},
        configurable: true
    });

    try {
        assert.equal(protocol.hasWebCrypto(), false);
        assert.throws(
            () => protocol.randomBytes(12),
            /Encrypted Blossom transfers require Web Crypto/
        );
        await assert.rejects(
            protocol.generateContentKey(),
            /Encrypted Blossom transfers require Web Crypto/
        );
    } finally {
        Object.defineProperty(globalThis, "crypto", {
            value: originalCrypto,
            configurable: true
        });
    }
});

test("Blossom controller refuses enable when Web Crypto is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    const originalIdentity = globalThis.meshdropNostrIdentity;
    const fired = [];

    globalThis.Events = {
        on() {},
        fire(type, detail) {
            fired.push({type, detail});
        }
    };
    globalThis.meshdropNostrIdentity = {
        getIdentity() {
            return {
                blossomServerListStatus: "found",
                blossomServers: ["https://blossom.test"]
            };
        }
    };
    Object.defineProperty(globalThis, "crypto", {
        value: {getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto)},
        configurable: true
    });

    try {
        const controller = new globalThis.BlossomTransferController();
        controller.enable();

        assert.equal(controller.isActive(), false);
        assert.deepEqual(fired, [{
            type: "notify-user",
            detail: "notifications.blossom-transfer-webcrypto-required"
        }]);
    } finally {
        globalThis.meshdropNostrIdentity = originalIdentity;
        Object.defineProperty(globalThis, "crypto", {
            value: originalCrypto,
            configurable: true
        });
        globalThis.Events = {on() {}, fire() {}};
    }
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

test("Blossom encrypted upload stores ciphertext and reconstructs plaintext", async () => {
    const storedObjects = new Map();
    const originalFetch = globalThis.fetch;
    const originalIdentity = globalThis.meshdropNostrIdentity;
    const plaintext = "raw blossom plaintext";

    globalThis.meshdropNostrIdentity = {
        signEvent(event) {
            return Promise.resolve({...event, id: "event-id", sig: "sig", pubkey: "a".repeat(64)});
        },
        getIdentity() {
            return {blossomServers: ["https://blossom.test"]};
        }
    };

    globalThis.fetch = async (url, options = {}) => {
        if (String(url).endsWith("/upload")) {
            const blob = options.body;
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const sha256 = await protocol.sha256Hex(blob);
            storedObjects.set(sha256, bytes);
            return new Response(JSON.stringify({
                url: `https://blossom.test/${sha256}`,
                sha256,
                size: blob.size,
                type: blob.type,
                uploaded: 1000
            }), {status: 200, headers: {"Content-Type": "application/json"}});
        }

        const hash = String(url).split("/").pop();
        const bytes = storedObjects.get(hash);
        if (!bytes) return new Response("", {status: 404});
        return new Response(bytes);
    };

    try {
        const controller = new globalThis.BlossomTransferController();
        const contentKey = await protocol.generateContentKey();
        const headers = [{name: "secret.txt", mime: "text/plain", size: plaintext.length}];
        const {blossomDescriptors, blossomEncryption} = await controller.uploadEncryptedFiles(
            [new File([plaintext], "secret.txt", {type: "text/plain"})],
            headers,
            contentKey
        );

        const uploaded = storedObjects.get(blossomDescriptors[0].sha256);
        assert.notEqual(Buffer.from(uploaded).toString("utf8"), plaintext);
        assert.equal(blossomDescriptors[0].size, uploaded.length);

        const downloaded = await controller.downloadDescriptor(blossomDescriptors[0], headers[0], {
            envelope: blossomEncryption,
            contentKey,
            index: 0
        });

        assert.equal(downloaded.name, "secret.txt");
        assert.equal(downloaded.type, "text/plain");
        assert.equal(await downloaded.text(), plaintext);
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.meshdropNostrIdentity = originalIdentity;
    }
});

test("Blossom encrypted download rejects wrong key and AAD", async () => {
    const contentKey = await protocol.generateContentKey();
    const wrongKey = await protocol.generateContentKey();
    const header = {name: "secret.txt", mime: "text/plain", size: 5};
    const transferId = protocol.createTransferId();
    const encrypted = await protocol.encryptFile(new File(["hello"], "secret.txt", {type: "text/plain"}), contentKey, {
        transferId,
        index: 0,
        header
    });

    await assert.rejects(
        protocol.decryptFile(encrypted.blob, wrongKey, {
            transferId,
            index: 0,
            header,
            fileEnvelope: encrypted.envelope
        }),
        /operation failed|decrypt/i
    );

    await assert.rejects(
        protocol.decryptFile(encrypted.blob, contentKey, {
            transferId,
            index: 0,
            header: {...header, name: "tampered.txt"},
            fileEnvelope: encrypted.envelope
        }),
        /operation failed|decrypt/i
    );
});

test("Blossom encrypted receiver without crypto.subtle decrypts through bundled fallback", async () => {
    const originalFetch = globalThis.fetch;
    const fixture = await createEncryptedBlossomFixture({plaintext: "raw blossom plaintext"});

    globalThis.fetch = async () => new Response(fixture.encrypted.blob);

    try {
        await withNoSubtleCrypto(async () => {
            assert.equal(protocol.hasSubtleCrypto(), false);

            const controller = new globalThis.BlossomTransferController();
            const downloaded = await controller.downloadDescriptor(fixture.descriptor, fixture.header, {
                envelope: fixture.envelope,
                contentKey: {rawKey: fixture.rawKey},
                index: 0
            });

            assert.equal(downloaded.name, fixture.header.name);
            assert.equal(downloaded.type, fixture.header.mime);
            assert.equal(await downloaded.text(), "raw blossom plaintext");
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Blossom fallback decrypt rejects wrong key, AAD, and tag", async () => {
    const fixture = await createEncryptedBlossomFixture();
    const wrongKey = protocol.randomBytes(32);

    await withNoSubtleCrypto(async () => {
        await assert.rejects(
            protocol.decryptFile(fixture.encrypted.blob, {rawKey: wrongKey}, {
                transferId: fixture.envelope.transferId,
                index: 0,
                header: fixture.header,
                fileEnvelope: fixture.encrypted.envelope
            }),
            /authentication failed|fallback failed/i
        );

        await assert.rejects(
            protocol.decryptFile(fixture.encrypted.blob, {rawKey: fixture.rawKey}, {
                transferId: fixture.envelope.transferId,
                index: 0,
                header: {...fixture.header, name: "tampered.txt"},
                fileEnvelope: fixture.encrypted.envelope
            }),
            /authentication failed|fallback failed/i
        );

        const tamperedBytes = new Uint8Array(await fixture.encrypted.blob.arrayBuffer());
        tamperedBytes[tamperedBytes.length - 1] ^= 1;
        await assert.rejects(
            protocol.decryptFile(new Blob([tamperedBytes]), {rawKey: fixture.rawKey}, {
                transferId: fixture.envelope.transferId,
                index: 0,
                header: fixture.header,
                fileEnvelope: fixture.encrypted.envelope
            }),
            /authentication failed|fallback failed/i
        );
    });
});

test("Blossom encrypted download still rejects descriptor tampering before decrypt", async () => {
    const originalFetch = globalThis.fetch;
    const blob = new Blob(["ciphertext"]);
    const sha256 = await protocol.sha256Hex(blob);

    globalThis.fetch = async () => new Response(blob);

    try {
        const controller = new globalThis.BlossomTransferController();
        await assert.rejects(
            controller.downloadDescriptor(
                {url: "https://blossom.test/object", sha256: "0".repeat(64), size: blob.size},
                {name: "secret.txt", mime: "text/plain", size: 5},
                {
                    envelope: {
                        version: protocol.encryptionVersion,
                        algorithm: protocol.contentAlgorithm,
                        transferId: protocol.createTransferId(),
                        files: [{index: 0, iv: protocol.bytesToBase64Url(protocol.randomBytes(12)), tagLength: 128}]
                    },
                    contentKey: await protocol.generateContentKey(),
                    index: 0
                }
            ),
            /hash mismatch/
        );
        assert.equal(sha256.length, 64);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Blossom encrypted download rejects descriptor tampering before fallback decrypt", async () => {
    const originalFetch = globalThis.fetch;
    const fixture = await createEncryptedBlossomFixture();

    globalThis.fetch = async () => new Response(fixture.encrypted.blob);

    try {
        await withNoSubtleCrypto(async () => {
            const originalAesGcmFallback = globalThis.meshdropBlossomAesGcmFallback;
            globalThis.meshdropBlossomAesGcmFallback = async () => {
                throw new Error("decrypt fallback should not run before descriptor validation");
            };

            try {
                const controller = new globalThis.BlossomTransferController();
                await assert.rejects(
                    controller.downloadDescriptor(
                        {...fixture.descriptor, sha256: "0".repeat(64)},
                        fixture.header,
                        {
                            envelope: fixture.envelope,
                            contentKey: {rawKey: fixture.rawKey},
                            index: 0
                        }
                    ),
                    /hash mismatch/
                );
            } finally {
                globalThis.meshdropBlossomAesGcmFallback = originalAesGcmFallback;
            }
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});
