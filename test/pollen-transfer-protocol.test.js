import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.localStorage = {
    values: new Map(),
    getItem(key) {
        return this.values.get(key) || null;
    },
    setItem(key, value) {
        this.values.set(key, String(value));
    }
};
globalThis.$ = () => null;
globalThis.Events = {on() {}, fire() {}};

await import("../public/scripts/pollen-transfer.js");

const protocol = globalThis.PollenTransferProtocol;

test("Pollen protocol persists enabled state and reads config", () => {
    protocol.writeEnabled(true);
    assert.equal(protocol.readEnabled(), true);
    protocol.writeEnabled(false);
    assert.equal(protocol.readEnabled(), false);

    assert.equal(protocol.enabledFromConfig({pollen: {enabled: true}}), true);
    assert.equal(protocol.enabledFromConfig({pollen: {enabled: false}}), false);
});

test("Pollen protocol validates descriptors", () => {
    const descriptor = protocol.validateDescriptor({
        hash: "A".repeat(64),
        size: 5,
        type: "text/plain"
    }, new File(["hello"], "hello.txt", {type: "text/plain"}));

    assert.deepEqual(descriptor, {
        hash: "a".repeat(64),
        size: 5,
        type: "text/plain"
    });
    assert.throws(() => protocol.validateDescriptor({hash: "bad", size: 1}), /hash is invalid/);
    assert.throws(
        () => protocol.validateDescriptor({hash: "a".repeat(64), size: 4}, new File(["hello"], "hello.txt")),
        /size mismatch/
    );
});

test("Pollen controller uploads and downloads descriptors", async () => {
    const originalFetch = globalThis.fetch;
    const controller = new globalThis.PollenTransferController();
    const calls = [];

    globalThis.fetch = async (url, options = {}) => {
        calls.push({url, options});
        if (url === "pollen/upload") {
            return new Response(JSON.stringify({
                hash: "b".repeat(64),
                size: 5,
                type: options.headers["Content-Type"]
            }), {status: 200});
        }
        if (url === `pollen/download/${"b".repeat(64)}`) {
            return new Response(new Blob(["hello"], {type: "text/plain"}), {status: 200});
        }
        throw new Error(`unexpected fetch ${url}`);
    };

    try {
        const [descriptor] = await controller.uploadFiles([new File(["hello"], "hello.txt", {type: "text/plain"})]);
        const file = await controller.downloadDescriptor(descriptor, {
            name: "hello.txt",
            mime: "text/plain"
        });

        assert.equal(descriptor.hash, "b".repeat(64));
        assert.equal(file.name, "hello.txt");
        assert.equal(await file.text(), "hello");
        assert.deepEqual(calls.map(call => call.url), [
            "pollen/upload",
            `pollen/download/${"b".repeat(64)}`
        ]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
