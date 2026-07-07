import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const routeContractSource = fs.readFileSync(new URL("../public/scripts/route-contract.js", import.meta.url), "utf8");
const instanceRelaySource = fs.readFileSync(new URL("../public/scripts/instance-relay-transfer.js", import.meta.url), "utf8");

function createContext() {
    const context = {
        Date,
        File,
        globalThis: null,
        location: {host: "sender.meshdrop.test"}
    };
    context.globalThis = context;
    vm.runInNewContext(routeContractSource, context);
    vm.runInNewContext(instanceRelaySource, context);
    return context;
}

function relayRequest(context, overrides = {}) {
    const ownerPubkey = "a".repeat(64);
    const descriptor = context.InstanceRelayTransferProtocol.buildDescriptor({
        routeType: "pollen",
        primitive: "pollen-object-store",
        ownerPubkey,
        sessionId: "session-1",
        endpoint: {
            uploadPath: "pollen/upload",
            downloadPath: "pollen/download",
            rooms: ["room-a", "room-a"]
        }
    });
    const proofSeed = context.InstanceRelayTransferProtocol.buildProofSeed({
        routeType: "pollen",
        primitive: "pollen-object-store",
        senderRuntime: "browser:sender.meshdrop.test",
        bytesSent: 12
    });

    return {
        payloadEncryption: {
            transferId: "session-1",
            keyDelivery: {
                senderPubkey: ownerPubkey,
                recipientPubkey: "b".repeat(64)
            }
        },
        pollenInstanceRelay: {
            descriptor: {
                ...descriptor,
                ...(overrides.descriptor || {})
            },
            proofSeed: {
                ...proofSeed,
                ...(overrides.proofSeed || {})
            }
        }
    };
}

test("builds and validates generic instance-relay descriptors and proof", () => {
    const context = createContext();
    const request = relayRequest(context);
    const relay = context.InstanceRelayTransferProtocol.validateRequest(request, {
        metadataKey: "pollenInstanceRelay",
        routeType: "pollen",
        primitive: "pollen-object-store"
    });

    assert.equal(relay.descriptor.routeType, "pollen");
    assert.equal(relay.descriptor.transportShape, "instance-relay");
    assert.equal(relay.descriptor.endpoint.primitive, "pollen-object-store");
    assert.deepEqual(Array.from(relay.descriptor.endpoint.rooms), ["room-a"]);
    assert.equal(relay.descriptor.capabilities.webRtcDataPath, false);
    assert.equal(relay.descriptor.capabilities.instanceRelay, true);

    const proof = context.InstanceRelayTransferProtocol.finalizeProof({
        request,
        relay,
        encryptedFiles: [new File(["cipher-bytes"], "payload.bin")],
        recipientRuntime: "browser:recipient.meshdrop.test",
        hashMatched: true
    });

    assert.deepEqual(context.MeshDropRouteContract.validateRouteProof(proof).ok, true);
    assert.equal(proof.routeType, "pollen");
    assert.equal(proof.dataPlanePrimitive, "pollen-object-store");
    assert.equal(proof.webRtcUsed, false);
    assert.equal(proof.instanceRelayed, true);
    assert.equal(proof.bytesSent, 12);
    assert.equal(proof.bytesReceived, 12);
    assert.equal(proof.hashMatched, true);
    assert.equal(proof.fallbackUsed, false);
});

test("generic instance-relay validation fails closed on unsafe proof or descriptor claims", () => {
    const context = createContext();

    assert.throws(
        () => context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context, {
            proofSeed: {fallbackUsed: true}
        }), {
            metadataKey: "pollenInstanceRelay",
            routeType: "pollen",
            primitive: "pollen-object-store"
        }),
        /fallback/
    );
    assert.throws(
        () => context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context, {
            proofSeed: {webRtcUsed: true}
        }), {
            metadataKey: "pollenInstanceRelay",
            routeType: "pollen",
            primitive: "pollen-object-store"
        }),
        /WebRTC/
    );
    assert.throws(
        () => context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context, {
            descriptor: {sessionId: "wrong-session"}
        }), {
            metadataKey: "pollenInstanceRelay",
            routeType: "pollen",
            primitive: "pollen-object-store"
        }),
        /session/
    );
    assert.throws(
        () => context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context, {
            descriptor: {endpoint: {primitive: "wrong-primitive"}}
        }), {
            metadataKey: "pollenInstanceRelay",
            routeType: "pollen",
            primitive: "pollen-object-store"
        }),
        /primitive/
    );
    assert.throws(
        () => context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context, {
            descriptor: {capabilities: {instanceRelay: false, webRtcDataPath: false}}
        }), {
            metadataKey: "pollenInstanceRelay",
            routeType: "pollen",
            primitive: "pollen-object-store"
        }),
        /instance relay/
    );
    assert.throws(
        () => context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context, {
            descriptor: {constraints: {encrypted: true, private: true, fallback: true}}
        }), {
            metadataKey: "pollenInstanceRelay",
            routeType: "pollen",
            primitive: "pollen-object-store"
        }),
        /fallback constraint/
    );
    assert.throws(
        () => context.InstanceRelayTransferProtocol.finalizeProof({
            request: relayRequest(context),
            relay: context.InstanceRelayTransferProtocol.validateRequest(relayRequest(context), {
                metadataKey: "pollenInstanceRelay",
                routeType: "pollen",
                primitive: "pollen-object-store"
            }),
            encryptedFiles: [new File(["cipher-bytes"], "payload.bin")],
            recipientRuntime: "browser:recipient.meshdrop.test",
            hashMatched: false
        }),
        /hash/
    );
});
