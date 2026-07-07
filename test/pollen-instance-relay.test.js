import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

const routeContractSource = fs.readFileSync(new URL("../public/scripts/route-contract.js", import.meta.url), "utf8");
const instanceRelaySource = fs.readFileSync(new URL("../public/scripts/instance-relay-transfer.js", import.meta.url), "utf8");
const blossomSource = fs.readFileSync(new URL("../public/scripts/blossom-transfer.js", import.meta.url), "utf8");
const pollenSource = fs.readFileSync(new URL("../public/scripts/pollen-transfer.js", import.meta.url), "utf8");
const networkSource = fs.readFileSync(new URL("../public/scripts/network.js", import.meta.url), "utf8");

function createHarness({localPubkey = "a".repeat(64), peerPubkey = "b".repeat(64)} = {}) {
    const sent = [];
    const fired = [];
    let pollenUploadFiles = [];
    let capturedWrapPlaintext = "";
    let downloadedFiles = [];

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
        TextDecoder,
        crypto: webcrypto,
        btoa: value => Buffer.from(value, "binary").toString("base64"),
        atob: value => Buffer.from(value, "base64").toString("binary"),
        window: {iOS: false},
        location: {protocol: "http:", host: `${localPubkey.slice(0, 8)}.meshdrop.test`, origin: `http://${localPubkey.slice(0, 8)}.meshdrop.test`, pathname: "/"},
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

    vm.runInNewContext(routeContractSource, context);
    vm.runInNewContext(instanceRelaySource, context);
    vm.runInNewContext(blossomSource, context);
    vm.runInNewContext(pollenSource, context);

    context.meshdropNostrIdentity = {
        getIdentity() {
            return {pubkey: localPubkey};
        },
        canNip44() {
            return true;
        },
        async encryptNip44To(_pubkey, plaintext) {
            capturedWrapPlaintext = plaintext;
            return "wrapped-key";
        },
        async decryptNip44From() {
            return capturedWrapPlaintext;
        }
    };
    context.meshdropPollenTransfer = {
        isActive: () => true,
        runtimeId: () => `browser:${context.location.host}`,
        async uploadFiles(files) {
            pollenUploadFiles = [...files];
            return files.map(file => ({
                hash: "4".repeat(64),
                size: file.size,
                type: file.type || "application/octet-stream"
            }));
        },
        async downloadDescriptor(_descriptor, header) {
            const file = downloadedFiles.shift();
            if (!file) throw new Error("missing downloaded file");
            return new File([await file.arrayBuffer()], header.name, {
                type: header.mime || file.type || "application/octet-stream"
            });
        }
    };

    vm.runInNewContext(`${networkSource}\nglobalThis.__meshdropTest = {WSPeer};`, context);

    return {
        context,
        WSPeer: context.__meshdropTest.WSPeer,
        sent,
        fired,
        localPubkey,
        peerPubkey,
        getPollenUploadFiles: () => pollenUploadFiles,
        setDownloadedFiles(files) {
            downloadedFiles = [...files];
        },
        setLocalPubkey(pubkey) {
            context.meshdropNostrIdentity.getIdentity = () => ({pubkey});
            context.location.host = `${pubkey.slice(0, 8)}.meshdrop.test`;
            context.location.origin = `http://${pubkey.slice(0, 8)}.meshdrop.test`;
        },
        server: {send: message => sent.push(JSON.parse(JSON.stringify(message)))}
    };
}

test("private Pollen route uploads ciphertext and attaches instance-relay descriptor and proof seed", async () => {
    const harness = createHarness();
    const peer = new harness.WSPeer(harness.server, false, harness.peerPubkey, "pollen", "npub-network:pairwise");
    peer._isBlossomKeyDeliveryChannelTrusted = () => true;

    await peer.requestPollenFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "pollen", type: "storage", label: "Pollen", privacyMode: "private"}
    );

    const request = harness.sent.find(message => message.type === "pollen-request");
    const uploaded = harness.getPollenUploadFiles()[0];

    assert.equal(request.payloadPrivacy.mode, "private");
    assert.equal(request.payloadEncryption.keyDelivery.type, "nip44");
    assert.notEqual(await uploaded.text(), "secret");
    assert.equal(uploaded.type, "application/octet-stream");
    assert.equal(uploaded.size, request.payloadHeaders[0].size);
    assert.equal(uploaded.size > request.header[0].size, true);

    assert.equal(request.pollenInstanceRelay.descriptor.routeType, "pollen");
    assert.equal(request.pollenInstanceRelay.descriptor.transportShape, "instance-relay");
    assert.equal(request.pollenInstanceRelay.descriptor.ownerPubkey, harness.localPubkey);
    assert.equal(request.pollenInstanceRelay.descriptor.sessionId, request.payloadEncryption.transferId);
    assert.equal(request.pollenInstanceRelay.descriptor.endpoint.primitive, "pollen-object-store");
    assert.equal(request.pollenInstanceRelay.descriptor.capabilities.webRtcDataPath, false);

    assert.deepEqual(harness.context.MeshDropRouteContract.validateDescriptor(
        request.pollenInstanceRelay.descriptor,
        {
            expectedOwnerPubkey: harness.localPubkey,
            expectedSessionId: request.payloadEncryption.transferId,
            now: Date.now()
        }
    ).ok, true);

    assert.deepEqual(request.pollenInstanceRelay.proofSeed, {
        senderRuntime: `browser:${harness.localPubkey.slice(0, 8)}.meshdrop.test`,
        routeType: "pollen",
        dataPlanePrimitive: "pollen-object-store",
        webRtcUsed: false,
        instanceRelayed: true,
        bytesSent: uploaded.size,
        fallbackUsed: false
    });
});

test("recipient decrypts Pollen instance relay, verifies hash, and emits route proof", async () => {
    const harness = createHarness();
    const sender = new harness.WSPeer(harness.server, false, harness.peerPubkey, "pollen", "npub-network:pairwise");

    await sender.requestPollenFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "pollen", type: "storage", label: "Pollen", privacyMode: "private"}
    );
    const request = harness.sent.find(message => message.type === "pollen-request");
    harness.setDownloadedFiles(harness.getPollenUploadFiles());
    harness.setLocalPubkey(harness.peerPubkey);

    const recipient = new harness.WSPeer(harness.server, false, harness.localPubkey, "pollen", "npub-network:pairwise");
    await recipient._downloadPollenFiles(request);

    const proof = harness.fired.find(event => event.type === "route-proof")?.detail;
    assert.deepEqual(harness.context.MeshDropRouteContract.validateRouteProof(proof).ok, true);
    assert.equal(proof.senderRuntime, `browser:${harness.localPubkey.slice(0, 8)}.meshdrop.test`);
    assert.equal(proof.recipientRuntime, `browser:${harness.peerPubkey.slice(0, 8)}.meshdrop.test`);
    assert.equal(proof.routeType, "pollen");
    assert.equal(proof.dataPlanePrimitive, "pollen-object-store");
    assert.equal(proof.webRtcUsed, false);
    assert.equal(proof.instanceRelayed, true);
    assert.equal(proof.bytesSent, request.payloadHeaders[0].size);
    assert.equal(proof.bytesReceived, request.payloadHeaders[0].size);
    assert.equal(proof.hashMatched, true);
    assert.equal(proof.fallbackUsed, false);
});

test("private local Pollen storage stays compatible without instance-relay proof metadata", async () => {
    const harness = createHarness();
    const peer = new harness.WSPeer(harness.server, false, harness.peerPubkey, "ip", "127.0.0.1");

    await peer.requestPollenFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "pollen", type: "storage", label: "Pollen", privacyMode: "private"}
    );
    const request = harness.sent.find(message => message.type === "pollen-request");

    assert.equal(request.payloadPrivacy.mode, "private");
    assert.equal(request.payloadEncryption.keyDelivery.type, "nip44");
    assert.equal(request.pollenInstanceRelay, undefined);
});

test("Pollen instance relay proof fails closed on missing runtime, bad descriptor binding, hash mismatch, or fallback", async () => {
    const harness = createHarness();
    const sender = new harness.WSPeer(harness.server, false, harness.peerPubkey, "pollen", "npub-network:pairwise");

    await sender.requestPollenFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "pollen", type: "storage", label: "Pollen", privacyMode: "private"}
    );
    const request = harness.sent.find(message => message.type === "pollen-request");

    assert.throws(
        () => harness.context.PollenTransferProtocol.validateInstanceRelayRequest({
            ...request,
            pollenInstanceRelay: {
                ...request.pollenInstanceRelay,
                proofSeed: {...request.pollenInstanceRelay.proofSeed, senderRuntime: ""}
            }
        }),
        /sender runtime/
    );
    assert.throws(
        () => harness.context.PollenTransferProtocol.validateInstanceRelayRequest({
            ...request,
            pollenInstanceRelay: {
                ...request.pollenInstanceRelay,
                descriptor: {...request.pollenInstanceRelay.descriptor, sessionId: "wrong-session"}
            }
        }),
        /session/
    );
    assert.throws(
        () => harness.context.PollenTransferProtocol.validateInstanceRelayRequest({
            ...request,
            pollenInstanceRelay: {
                ...request.pollenInstanceRelay,
                descriptor: {...request.pollenInstanceRelay.descriptor, ownerPubkey: "c".repeat(64)}
            }
        }),
        /owner/
    );
    assert.throws(
        () => harness.context.PollenTransferProtocol.validateInstanceRelayRequest({
            ...request,
            pollenInstanceRelay: {
                ...request.pollenInstanceRelay,
                descriptor: {...request.pollenInstanceRelay.descriptor, expiresAt: Date.now() - 1}
            }
        }),
        /expired/
    );
    assert.throws(
        () => harness.context.PollenTransferProtocol.validateInstanceRelayRequest({
            ...request,
            pollenInstanceRelay: {
                ...request.pollenInstanceRelay,
                proofSeed: {...request.pollenInstanceRelay.proofSeed, fallbackUsed: true}
            }
        }),
        /fallback/
    );
    assert.throws(
        () => harness.context.PollenTransferProtocol.validateInstanceRelayRequest({
            ...request,
            payloadEncryption: {
                ...request.payloadEncryption,
                keyDelivery: null
            }
        }),
        /owner binding/
    );
    await assert.rejects(
        harness.context.PollenTransferProtocol.finalizeInstanceRelayProof({
            request: {
                ...request,
                payloadIntegrity: {
                    ...request.payloadIntegrity,
                    files: [{index: 0, sha256: "0".repeat(64)}]
                }
            },
            encryptedFiles: harness.getPollenUploadFiles(),
            decryptedFiles: [new File(["secret"], "secret.txt", {type: "text/plain"})],
            recipientRuntime: "browser:recipient.meshdrop.test"
        }),
        /hash mismatch/
    );
});
