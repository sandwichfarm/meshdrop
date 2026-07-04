import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

const blossomSource = fs.readFileSync(new URL("../public/scripts/blossom-transfer.js", import.meta.url), "utf8");
const networkSource = fs.readFileSync(new URL("../public/scripts/network.js", import.meta.url), "utf8");

function createHarness({nip44 = true, noSubtle = false} = {}) {
    const sent = [];
    const fired = [];
    let uploadCount = 0;
    let capturedWrapPlaintext = "";
    const senderPubkey = "a".repeat(64);
    const recipientPubkey = "b".repeat(64);

    const context = {
        console: {log() {}, warn() {}, error() {}},
        setTimeout,
        clearTimeout,
        Date,
        Math,
        URL,
        Blob,
        File,
        Response,
        TextEncoder,
        crypto: noSubtle ? {getRandomValues: webcrypto.getRandomValues.bind(webcrypto)} : webcrypto,
        btoa: value => Buffer.from(value, "binary").toString("base64"),
        atob: value => Buffer.from(value, "base64").toString("binary"),
        window: {iOS: false},
        location: {protocol: "http:", host: "meshdrop.test", pathname: "/"},
        navigator: {},
        sessionStorage: {getItem: () => null, setItem() {}},
        localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
        Events: {
            on() {},
            fire(type, detail) {
                fired.push({type, detail});
            }
        },
        Localization: {
            getTranslation(key) {
                return key;
            }
        },
        BrowserTabsConnector: {
            peerIsSameBrowser: () => false,
            addPeerIdToLocalStorage: () => Promise.resolve("self"),
            removePeerIdFromLocalStorage: () => Promise.resolve(null),
            removeOtherPeerIdsFromLocalStorage: () => Promise.resolve([])
        },
        PersistentStorage: {
            getRoomSecretEntry: () => Promise.resolve(null),
            deleteRoomSecret: () => Promise.resolve(null),
            getAllRoomSecrets: () => Promise.resolve([])
        },
        getThumbnailAsDataUrl: () => Promise.resolve("")
    };
    context.globalThis = context;

    vm.runInNewContext(blossomSource, context);

    context.meshdropNostrIdentity = {
        getIdentity() {
            return {pubkey: senderPubkey};
        },
        canNip44() {
            return nip44;
        },
        async encryptNip44To(_pubkey, plaintext) {
            capturedWrapPlaintext = plaintext;
            return "wrapped-key";
        }
    };
    context.meshdropBlossomTransfer = {
        async uploadEncryptedFiles(_files, _headers, _contentKey) {
            uploadCount += 1;
            return {
                blossomDescriptors: [{
                    url: "https://blossom.test/ciphertext",
                    sha256: "1".repeat(64),
                    size: 64,
                    type: "application/octet-stream",
                    uploaded: 1000
                }],
                blossomEncryption: {
                    version: context.BlossomTransferProtocol.encryptionVersion,
                    algorithm: context.BlossomTransferProtocol.contentAlgorithm,
                    transferId: context.BlossomTransferProtocol.createTransferId(),
                    files: [{index: 0, iv: context.BlossomTransferProtocol.bytesToBase64Url(new Uint8Array(12)), tagLength: 128}]
                }
            };
        }
    };

    vm.runInNewContext(`${networkSource}\nglobalThis.__meshdropTest = {WSPeer};`, context);

    return {
        WSPeer: context.__meshdropTest.WSPeer,
        sent,
        fired,
        senderPubkey,
        recipientPubkey,
        getUploadCount: () => uploadCount,
        getCapturedWrapPlaintext: () => capturedWrapPlaintext,
        server: {send: message => sent.push(JSON.parse(JSON.stringify(message)))}
    };
}

test("untrusted Blossom request wraps key with NIP-44 and omits raw key JSON", async () => {
    const harness = createHarness();
    const peer = new harness.WSPeer(harness.server, false, harness.recipientPubkey, "ip", "room");

    await peer.requestBlossomFileTransfer([new File(["secret"], "secret.txt", {type: "text/plain"})]);

    const request = harness.sent.find(message => message.type === "blossom-request");
    const rawKey = JSON.parse(harness.getCapturedWrapPlaintext()).key;

    assert.equal(harness.getUploadCount(), 1);
    assert.equal(request.blossomEncryption.keyDelivery.type, "nip44");
    assert.equal(request.blossomEncryption.keyDelivery.senderPubkey, harness.senderPubkey);
    assert.equal(request.blossomEncryption.keyDelivery.recipientPubkey, harness.recipientPubkey);
    assert.equal(JSON.stringify(request).includes(rawKey), false);
});

test("untrusted Blossom request fails closed when NIP-44 wrapping is unavailable", async () => {
    const harness = createHarness({nip44: false});
    const peer = new harness.WSPeer(harness.server, false, harness.recipientPubkey, "ip", "room");

    await peer.requestBlossomFileTransfer([new File(["secret"], "secret.txt", {type: "text/plain"})]);

    assert.equal(harness.getUploadCount(), 0);
    assert.equal(harness.sent.some(message => message.type === "blossom-request"), false);
    assert.equal(
        harness.fired.some(event => event.type === "notify-user" && String(event.detail).includes("NIP-44")),
        true
    );
});

test("Blossom sender without crypto.subtle fails before upload", async () => {
    const harness = createHarness({noSubtle: true});
    const peer = new harness.WSPeer(harness.server, false, harness.recipientPubkey, "ip", "room");

    await peer.requestBlossomFileTransfer([new File(["secret"], "secret.txt", {type: "text/plain"})]);

    assert.equal(harness.getUploadCount(), 0);
    assert.equal(harness.sent.some(message => message.type === "blossom-request"), false);
    assert.equal(
        harness.fired.some(event => event.type === "notify-user" && String(event.detail).includes("Web Crypto")),
        true
    );
});

test("incoming Blossom request without encryption envelope is rejected", () => {
    const harness = createHarness();
    const peer = new harness.WSPeer(harness.server, false, harness.recipientPubkey, "ip", "room");

    peer._onMessage(JSON.stringify({
        type: "blossom-request",
        header: [{name: "secret.txt", mime: "text/plain", size: 6}],
        totalSize: 6,
        imagesOnly: false,
        blossomDescriptors: []
    }));

    assert.deepEqual(harness.sent[0], {
        type: "files-transfer-response",
        accepted: false,
        reason: "blossom-encryption-required",
        to: harness.recipientPubkey,
        roomType: "ip",
        roomId: "room"
    });
});
