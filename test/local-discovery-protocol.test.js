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

test("clearnet routes default to enabled", () => {
    storage.clear();

    assert.equal(globalThis.LocalDiscoveryProtocol.readEnabled(), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("ip"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("nostr"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("fips"), true);
});

test("clearnet routes gate direct IP and Nostr room types", () => {
    storage.clear();
    globalThis.LocalDiscoveryProtocol.writeEnabled(false);

    assert.equal(globalThis.LocalDiscoveryProtocol.readEnabled(), false);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("ip"), false);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("nostr"), false);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("fips"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("pollen"), true);
});
