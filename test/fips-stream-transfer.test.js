import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

const routeContractSource = fs.readFileSync(new URL("../public/scripts/route-contract.js", import.meta.url), "utf8");
const instanceRelaySource = fs.readFileSync(new URL("../public/scripts/instance-relay-transfer.js", import.meta.url), "utf8");
const blossomSource = fs.readFileSync(new URL("../public/scripts/blossom-transfer.js", import.meta.url), "utf8");
const fipsStreamSource = fs.readFileSync(new URL("../public/scripts/fips-stream-transfer.js", import.meta.url), "utf8");
const networkSource = fs.readFileSync(new URL("../public/scripts/network.js", import.meta.url), "utf8");
const fipsStreamIntegrationSource = fs.readFileSync(
    new URL("../public/scripts/fips-stream-integration.js", import.meta.url),
    "utf8"
);

function createHarness({localPubkey = "a".repeat(64), peerPubkey = "b".repeat(64)} = {}) {
    const sent = [];
    const fired = [];
    let uploadedFiles = [];
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
        location: {
            protocol: "http:",
            host: `${localPubkey.slice(0, 8)}.meshdrop.test`,
            origin: `http://${localPubkey.slice(0, 8)}.meshdrop.test`,
            pathname: "/"
        },
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
    vm.runInNewContext(fipsStreamSource, context);

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
    context.meshdropFipsStreamTransfer = {
        isActive: () => true,
        runtimeId: () => `browser:${context.location.host}`,
        async uploadFiles(files) {
            uploadedFiles = [...files];
            return {
                baseUrl: "http://[fd12:3456:789a::1]:3000",
                descriptors: files.map((file, index) => ({
                    id: String(index + 1).padStart(32, "a"),
                    token: String(index + 1).padStart(64, "b"),
                    sha256: "4".repeat(64),
                    size: file.size,
                    type: file.type || "application/octet-stream"
                }))
            };
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
    vm.runInNewContext(fipsStreamIntegrationSource, context);

    return {
        context,
        WSPeer: context.__meshdropTest.WSPeer,
        sent,
        fired,
        localPubkey,
        peerPubkey,
        getUploadedFiles: () => uploadedFiles,
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

test("FIPS stream protocol builds route descriptors and proof seeds for FIPS mesh URLs", () => {
    const harness = createHarness();
    const descriptor = harness.context.FipsStreamTransferProtocol.buildStreamDescriptor({
        ownerPubkey: harness.localPubkey,
        sessionId: "session-1",
        baseUrl: "http://[fd12:3456:789a::1]:3000",
        files: [{
            id: "a".repeat(32),
            token: "b".repeat(64),
            sha256: "c".repeat(64),
            size: 5,
            type: "text/plain"
        }]
    });

    assert.equal(descriptor.routeType, "fips");
    assert.equal(descriptor.transportShape, "stream");
    assert.equal(descriptor.endpoint.primitive, "fips-http-stream");
    assert.equal(descriptor.endpoint.baseUrl, "http://[fd12:3456:789a::1]:3000");
    assert.equal(descriptor.capabilities.webRtcDataPath, false);
    assert.equal(harness.context.MeshDropRouteContract.validateDescriptor(descriptor, {
        expectedOwnerPubkey: harness.localPubkey,
        expectedSessionId: "session-1",
        now: Date.now()
    }).ok, true);

    assert.deepEqual(JSON.parse(JSON.stringify(harness.context.FipsStreamTransferProtocol.buildStreamProofSeed({
        senderRuntime: "browser:sender",
        bytesSent: 5
    }))), {
        senderRuntime: "browser:sender",
        routeType: "fips",
        dataPlanePrimitive: "fips-http-stream",
        webRtcUsed: false,
        instanceRelayed: false,
        bytesSent: 5,
        fallbackUsed: false
    });

    const relayDescriptor = harness.context.FipsStreamTransferProtocol.buildInstanceRelayDescriptor({
        ownerPubkey: harness.localPubkey,
        sessionId: "session-1",
        baseUrl: "http://[fd12:3456:789a::1]:3000",
        files: [{
            id: "a".repeat(32),
            token: "b".repeat(64),
            sha256: "c".repeat(64),
            size: 5,
            type: "text/plain"
        }]
    });

    assert.equal(relayDescriptor.routeType, "fips");
    assert.equal(relayDescriptor.transportShape, "instance-relay");
    assert.equal(relayDescriptor.endpoint.primitive, "fips-http-stream");
    assert.equal(relayDescriptor.endpoint.baseUrl, "http://[fd12:3456:789a::1]:3000");
    assert.equal(relayDescriptor.capabilities.webRtcDataPath, false);
    assert.equal(relayDescriptor.capabilities.instanceRelay, true);
    assert.equal(harness.context.MeshDropRouteContract.validateDescriptor(relayDescriptor, {
        expectedOwnerPubkey: harness.localPubkey,
        expectedSessionId: "session-1",
        now: Date.now()
    }).ok, true);

    assert.deepEqual(JSON.parse(JSON.stringify(harness.context.FipsStreamTransferProtocol.buildInstanceRelayProofSeed({
        senderRuntime: "browser:sender",
        bytesSent: 5
    }))), {
        senderRuntime: "browser:sender",
        routeType: "fips",
        dataPlanePrimitive: "fips-http-stream",
        webRtcUsed: false,
        instanceRelayed: true,
        bytesSent: 5,
        fallbackUsed: false
    });

    assert.throws(
        () => harness.context.FipsStreamTransferProtocol.buildStreamDescriptor({
            ownerPubkey: harness.localPubkey,
            sessionId: "session-1",
            baseUrl: "http://127.0.0.1:3000",
            files: []
        }),
        /FIPS mesh URL/
    );
});

test("private FIPS stream uploads ciphertext and attaches stream descriptor and proof seed", async () => {
    const harness = createHarness();
    const peer = new harness.WSPeer(harness.server, false, harness.peerPubkey, "fips", "npub-network:pairwise");
    peer._isBlossomKeyDeliveryChannelTrusted = () => true;

    await peer.requestFipsFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "fips", type: "storage", label: "FIPS Stream", privacyMode: "private"}
    );

    const request = harness.sent.find(message => message.type === "fips-request");
    const uploaded = harness.getUploadedFiles()[0];

    assert.equal(request.payloadPrivacy.mode, "private");
    assert.equal(request.payloadEncryption.keyDelivery.type, "nip44");
    assert.notEqual(await uploaded.text(), "secret");
    assert.equal(uploaded.type, "application/octet-stream");
    assert.equal(uploaded.size, request.payloadHeaders[0].size);

    assert.equal(request.fipsStream.descriptor.routeType, "fips");
    assert.equal(request.fipsStream.descriptor.transportShape, "stream");
    assert.equal(request.fipsStream.descriptor.ownerPubkey, harness.localPubkey);
    assert.equal(request.fipsStream.descriptor.sessionId, request.payloadEncryption.transferId);
    assert.equal(request.fipsStream.descriptor.endpoint.primitive, "fips-http-stream");
    assert.equal(request.fipsStream.descriptor.capabilities.webRtcDataPath, false);
    assert.deepEqual(request.fipsStream.proofSeed, {
        senderRuntime: `browser:${harness.localPubkey.slice(0, 8)}.meshdrop.test`,
        routeType: "fips",
        dataPlanePrimitive: "fips-http-stream",
        webRtcUsed: false,
        instanceRelayed: false,
        bytesSent: uploaded.size,
        fallbackUsed: false
    });

    assert.equal(request.fipsInstanceRelay.descriptor.routeType, "fips");
    assert.equal(request.fipsInstanceRelay.descriptor.transportShape, "instance-relay");
    assert.equal(request.fipsInstanceRelay.descriptor.ownerPubkey, harness.localPubkey);
    assert.equal(request.fipsInstanceRelay.descriptor.sessionId, request.payloadEncryption.transferId);
    assert.equal(request.fipsInstanceRelay.descriptor.endpoint.primitive, "fips-http-stream");
    assert.equal(request.fipsInstanceRelay.descriptor.endpoint.baseUrl, "http://[fd12:3456:789a::1]:3000");
    assert.equal(request.fipsInstanceRelay.descriptor.capabilities.webRtcDataPath, false);
    assert.equal(request.fipsInstanceRelay.descriptor.capabilities.instanceRelay, true);
    assert.deepEqual(harness.context.MeshDropRouteContract.validateDescriptor(
        request.fipsInstanceRelay.descriptor,
        {
            expectedOwnerPubkey: harness.localPubkey,
            expectedSessionId: request.payloadEncryption.transferId,
            now: Date.now()
        }
    ).ok, true);
    assert.deepEqual(request.fipsInstanceRelay.proofSeed, {
        senderRuntime: `browser:${harness.localPubkey.slice(0, 8)}.meshdrop.test`,
        routeType: "fips",
        dataPlanePrimitive: "fips-http-stream",
        webRtcUsed: false,
        instanceRelayed: true,
        bytesSent: uploaded.size,
        fallbackUsed: false
    });
});

test("recipient decrypts FIPS stream, verifies hash, and emits route proof", async () => {
    const harness = createHarness();
    const sender = new harness.WSPeer(harness.server, false, harness.peerPubkey, "fips", "npub-network:pairwise");

    await sender.requestFipsFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "fips", type: "storage", label: "FIPS Stream", privacyMode: "private"}
    );
    const request = harness.sent.find(message => message.type === "fips-request");
    harness.setDownloadedFiles(harness.getUploadedFiles());
    harness.setLocalPubkey(harness.peerPubkey);

    const recipient = new harness.WSPeer(harness.server, false, harness.localPubkey, "fips", "npub-network:pairwise");
    await recipient._downloadFipsFiles(request);

    const proof = harness.fired.find(event => event.type === "route-proof")?.detail;
    assert.deepEqual(harness.context.MeshDropRouteContract.validateRouteProof(proof).ok, true);
    assert.equal(proof.senderRuntime, `browser:${harness.localPubkey.slice(0, 8)}.meshdrop.test`);
    assert.equal(proof.recipientRuntime, `browser:${harness.peerPubkey.slice(0, 8)}.meshdrop.test`);
    assert.equal(proof.routeType, "fips");
    assert.equal(proof.dataPlanePrimitive, "fips-http-stream");
    assert.equal(proof.webRtcUsed, false);
    assert.equal(proof.instanceRelayed, true);
    assert.equal(proof.bytesSent, request.payloadHeaders[0].size);
    assert.equal(proof.bytesReceived, request.payloadHeaders[0].size);
    assert.equal(proof.hashMatched, true);
    assert.equal(proof.fallbackUsed, false);
});

test("recipient keeps legacy FIPS stream proof when instance-relay metadata is absent", async () => {
    const harness = createHarness();
    const sender = new harness.WSPeer(harness.server, false, harness.peerPubkey, "fips", "npub-network:pairwise");

    await sender.requestFipsFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "fips", type: "storage", label: "FIPS Stream", privacyMode: "private"}
    );
    const request = harness.sent.find(message => message.type === "fips-request");
    delete request.fipsInstanceRelay;
    harness.setDownloadedFiles(harness.getUploadedFiles());
    harness.setLocalPubkey(harness.peerPubkey);

    const recipient = new harness.WSPeer(harness.server, false, harness.localPubkey, "fips", "npub-network:pairwise");
    await recipient._downloadFipsFiles(request);

    const proof = harness.fired.find(event => event.type === "route-proof")?.detail;
    assert.deepEqual(harness.context.MeshDropRouteContract.validateRouteProof(proof).ok, true);
    assert.equal(proof.routeType, "fips");
    assert.equal(proof.dataPlanePrimitive, "fips-http-stream");
    assert.equal(proof.webRtcUsed, false);
    assert.equal(proof.instanceRelayed, false);
    assert.equal(proof.hashMatched, true);
    assert.equal(proof.fallbackUsed, false);
});

test("FIPS instance relay proof fails closed on bad descriptor binding, URL, hash, or fallback", async () => {
    const harness = createHarness();
    const sender = new harness.WSPeer(harness.server, false, harness.peerPubkey, "fips", "npub-network:pairwise");

    await sender.requestFipsFileTransfer(
        [new File(["secret"], "secret.txt", {type: "text/plain"})],
        {id: "fips", type: "storage", label: "FIPS Stream", privacyMode: "private"}
    );
    const request = harness.sent.find(message => message.type === "fips-request");

    assert.throws(
        () => harness.context.FipsStreamTransferProtocol.validateInstanceRelayRequest({
            ...request,
            fipsInstanceRelay: {
                ...request.fipsInstanceRelay,
                descriptor: {...request.fipsInstanceRelay.descriptor, sessionId: "wrong-session"}
            }
        }),
        /session/
    );
    assert.throws(
        () => harness.context.FipsStreamTransferProtocol.validateInstanceRelayRequest({
            ...request,
            fipsInstanceRelay: {
                ...request.fipsInstanceRelay,
                descriptor: {
                    ...request.fipsInstanceRelay.descriptor,
                    endpoint: {...request.fipsInstanceRelay.descriptor.endpoint, baseUrl: "http://127.0.0.1:3000"}
                }
            }
        }),
        /FIPS mesh URL/
    );
    assert.throws(
        () => harness.context.FipsStreamTransferProtocol.validateInstanceRelayRequest({
            ...request,
            fipsInstanceRelay: {
                ...request.fipsInstanceRelay,
                proofSeed: {...request.fipsInstanceRelay.proofSeed, fallbackUsed: true}
            }
        }),
        /fallback/
    );
    assert.throws(
        () => harness.context.FipsStreamTransferProtocol.validateInstanceRelayRequest({
            ...request,
            fipsInstanceRelay: {
                ...request.fipsInstanceRelay,
                proofSeed: {...request.fipsInstanceRelay.proofSeed, webRtcUsed: true}
            }
        }),
        /WebRTC/
    );
    assert.throws(
        () => harness.context.FipsStreamTransferProtocol.validateInstanceRelayRequest({
            ...request,
            fipsInstanceRelay: {
                ...request.fipsInstanceRelay,
                proofSeed: {...request.fipsInstanceRelay.proofSeed, instanceRelayed: false}
            }
        }),
        /relay flag|flag is missing/
    );
    await assert.rejects(
        harness.context.FipsStreamTransferProtocol.finalizeInstanceRelayProof({
            request: {
                ...request,
                payloadIntegrity: {
                    ...request.payloadIntegrity,
                    files: [{index: 0, sha256: "0".repeat(64)}]
                }
            },
            encryptedFiles: harness.getUploadedFiles(),
            decryptedFiles: [new File(["secret"], "secret.txt", {type: "text/plain"})],
            recipientRuntime: "browser:recipient.meshdrop.test"
        }),
        /hash mismatch/
    );
});
