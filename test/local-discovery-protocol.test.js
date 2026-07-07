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

test("instance and clearnet routes default to enabled", () => {
    storage.clear();

    assert.equal(globalThis.LocalDiscoveryProtocol.readEnabled(), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("ip"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("nostr"), true);
    assert.equal(globalThis.ClearnetRouteProtocol.readEnabled(), true);
    assert.equal(globalThis.ClearnetRouteProtocol.allowsRoomType("ip"), true);
    assert.equal(globalThis.ClearnetRouteProtocol.allowsRoomType("nostr"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("fips"), true);
});

test("instance route preference gates only same-instance IP room types", () => {
    storage.clear();
    globalThis.LocalDiscoveryProtocol.writeEnabled(false);

    assert.equal(globalThis.LocalDiscoveryProtocol.readEnabled(), false);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("ip"), false);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("nostr"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("fips"), true);
    assert.equal(globalThis.LocalDiscoveryProtocol.allowsRoomType("pollen"), true);
});

test("clearnet route preference gates only direct Nostr-signaled room types", () => {
    storage.clear();
    globalThis.ClearnetRouteProtocol.writeEnabled(false);

    assert.equal(globalThis.ClearnetRouteProtocol.readEnabled(), false);
    assert.equal(globalThis.ClearnetRouteProtocol.allowsRoomType("ip"), true);
    assert.equal(globalThis.ClearnetRouteProtocol.allowsRoomType("nostr"), false);
    assert.equal(globalThis.ClearnetRouteProtocol.allowsRoomType("fips"), true);
    assert.equal(globalThis.ClearnetRouteProtocol.allowsRoomType("pollen"), true);
});

test("clearnet route support can exist without same-instance discovery", () => {
    globalThis.RuntimeCapabilities = {
        transportSupported(config, name, defaultValue) {
            return config?.capabilities?.transports?.[name]?.supported ?? defaultValue;
        }
    };

    try {
        const config = {
            capabilities: {
                transports: {
                    localDiscovery: {supported: false},
                    nostr: {supported: true},
                    webrtc: {supported: true}
                }
            }
        };

        assert.equal(globalThis.LocalDiscoveryProtocol.localDiscoverySupportedFromConfig(config), false);
        assert.equal(globalThis.ClearnetRouteProtocol.routeSupportedFromConfig(config), true);
    }
    finally {
        delete globalThis.RuntimeCapabilities;
    }
});
