import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();

globalThis.$ = () => null;
globalThis.Events = {on() {}, fire() {}};
globalThis.localStorage = {
    getItem(key) {
        return storage.get(key) || null;
    },
    setItem(key, value) {
        storage.set(key, value);
    }
};

await import("../public/scripts/local-discovery.js");

test("local discovery defaults to enabled", () => {
    storage.clear();

    assert.equal(globalThis.LocalDiscoveryProtocol.readEnabled(), true);
});

test("local discovery persists explicit disabled state", () => {
    storage.clear();
    globalThis.LocalDiscoveryProtocol.writeEnabled(false);

    assert.equal(globalThis.LocalDiscoveryProtocol.readEnabled(), false);
});
