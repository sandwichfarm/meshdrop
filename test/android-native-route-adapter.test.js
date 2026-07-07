import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

const routeContractSource = fs.readFileSync(new URL("../public/scripts/route-contract.js", import.meta.url), "utf8");
const androidNativeRoutesSource = fs.readFileSync(new URL("../public/scripts/android-native-routes.js", import.meta.url), "utf8");
const OWNER = "a".repeat(64);
const SESSION = "android-native-session";
const NOW = 1_800_000_000_000;

test("Android native route adapter is unsupported without live loopback backend", () => {
    const harness = createHarness({backendAlive: false});
    const adapter = harness.context.meshdropAndroidNativeRouteAdapter;

    assert.deepEqual(jsonValue(harness.context.MeshDropRouteContract.validateAdapter(adapter)), {
        ok: true,
        availability: "unsupported",
        reason: "android-native-backend-unavailable",
        capabilities: [],
        methods: [
            "status",
            "capabilities",
            "descriptorFor",
            "acceptDescriptor",
            "send",
            "receive",
            "close",
            "proof"
        ]
    });
});

test("Android native route adapter exposes Pollen byte primitive and FIPS status honestly", async () => {
    const harness = createHarness({
        fipsStatus: {
            enabled: true,
            available: true,
            backend: "android-native-fipsctl",
            rustCore: true
        },
        pollenStatus: {
            enabled: true,
            available: true,
            backend: "android-native-pln",
            substrate: "pln",
            pln: true
        }
    });
    const adapter = harness.context.meshdropAndroidNativeRouteAdapter;

    await adapter.refreshStatus();

    assert.equal(harness.context.MeshDropRouteContract.validateAdapter(adapter).availability, "available");
    assert.deepEqual(jsonValue(adapter.capabilities()), [
        {
            routeType: "pollen",
            transportShape: "object-store",
            dataPlanePrimitive: "android-native-pln",
            nativeBridgeAvailable: true,
            transferSupported: true
        },
        {
            routeType: "fips",
            transportShape: "stream",
            dataPlanePrimitive: "android-native-fipsctl",
            nativeBridgeAvailable: true,
            transferSupported: false,
            statusOnly: true
        }
    ]);
});

test("Android native route adapter sends, receives, hashes, and validates route proof", async () => {
    const harness = createHarness();
    const adapter = harness.context.meshdropAndroidNativeRouteAdapter;
    await adapter.refreshStatus();

    const descriptor = adapter.descriptorFor({
        ownerPubkey: OWNER,
        sessionId: SESSION,
        expiresAt: NOW + 60_000,
        now: NOW
    });
    assert.equal(harness.context.MeshDropRouteContract.validateDescriptor(descriptor, {
        expectedOwnerPubkey: OWNER,
        expectedSessionId: SESSION,
        now: NOW
    }).ok, true);
    assert.equal(descriptor.endpoint.primitive, "android-native-object-store");

    const source = new File(["android-native-route-proof"], "android-native-route-proof.txt", {type: "text/plain"});
    const sent = await adapter.send([source], {
        ownerPubkey: OWNER,
        sessionId: SESSION,
        senderRuntime: "android-webview:sender"
    });
    const received = await adapter.receive(sent.descriptors, {
        recipientRuntime: "android-webview:recipient"
    });
    const proof = adapter.proof();

    assert.equal(received.files.length, 1);
    assert.equal(received.files[0].name, "android-native-route-proof.txt");
    assert.equal(await received.files[0].text(), "android-native-route-proof");
    assert.equal(proof.senderRuntime, "android-webview:sender");
    assert.equal(proof.recipientRuntime, "android-webview:recipient");
    assert.equal(proof.routeType, "pollen");
    assert.equal(proof.dataPlanePrimitive, "android-native-object-store");
    assert.equal(proof.webRtcUsed, false);
    assert.equal(proof.instanceRelayed, false);
    assert.equal(proof.bytesSent, source.size);
    assert.equal(proof.bytesReceived, source.size);
    assert.equal(proof.hashMatched, true);
    assert.equal(proof.fallbackUsed, false);
    assert.equal(harness.context.MeshDropRouteContract.validateRouteProof(proof).ok, true);
});

function createHarness({
    backendAlive = true,
    fipsStatus = {
        enabled: true,
        available: true,
        backend: "android-native",
        rustCore: false
    },
    pollenStatus = {
        enabled: true,
        available: true,
        backend: "android-native",
        substrate: "android-object-store",
        pln: false
    }
} = {}) {
    const objects = new Map();
    const context = {
        Blob,
        File,
        Response,
        TextDecoder,
        TextEncoder,
        URL,
        crypto: webcrypto,
        console: {log() {}, warn() {}, error() {}},
        Date,
        Math,
        location: {protocol: "file:", host: "", origin: "file://android_asset", pathname: "/android_asset/meshdrop/index.html"},
        __meshdropAndroidNativeBackend: backendAlive
            ? {alive: true, baseUrl: "http://127.0.0.1:9123"}
            : {alive: false, baseUrl: ""},
        __meshdropTargetManifest: {
            target: "android",
            runtime: {target: "android", platform: "mobile"}
        },
        async fetch(url, options = {}) {
            const requestUrl = String(url);
            if (requestUrl === "http://127.0.0.1:9123/fips/status") {
                return jsonResponse(fipsStatus);
            }
            if (requestUrl === "http://127.0.0.1:9123/pollen/status") {
                return jsonResponse(pollenStatus);
            }
            if (requestUrl === "http://127.0.0.1:9123/pollen/upload") {
                const body = new Uint8Array(await options.body.arrayBuffer());
                const hash = await sha256Hex(body);
                objects.set(hash, {
                    body,
                    type: options.headers?.["Content-Type"] || "application/octet-stream"
                });
                return jsonResponse({
                    hash,
                    size: body.length,
                    type: options.headers?.["Content-Type"] || "application/octet-stream",
                    backend: pollenStatus.backend
                });
            }
            const downloadPrefix = "http://127.0.0.1:9123/pollen/download/";
            if (requestUrl.startsWith(downloadPrefix)) {
                const object = objects.get(requestUrl.slice(downloadPrefix.length));
                if (!object) return jsonResponse({error: "not found"}, {status: 404});
                return new Response(object.body, {
                    status: 200,
                    headers: {"Content-Type": object.type}
                });
            }
            throw new Error(`unexpected fetch ${requestUrl}`);
        }
    };
    context.globalThis = context;
    context.window = context;

    vm.runInNewContext(routeContractSource, context);
    vm.runInNewContext(androidNativeRoutesSource, context);

    return {context};
}

function jsonResponse(value, init = {}) {
    return new Response(JSON.stringify(value), {
        status: init.status || 200,
        headers: {"Content-Type": "application/json"}
    });
}

function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}

async function sha256Hex(bytes) {
    const digest = await webcrypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}
