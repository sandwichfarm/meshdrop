import test from "node:test";
import assert from "node:assert/strict";

globalThis.$ = () => null;
globalThis.Events = {on() {}, fire() {}};
globalThis.Localization = {getTranslation(key) { return key; }};

await import("../public/scripts/fips-discovery.js");

const protocol = globalThis.FipsDiscoveryProtocol;

test("FIPS discovery protocol reads configured room and enabled state", () => {
    assert.equal(protocol.enabledFromConfig({fips: {enabled: true}}), true);
    assert.equal(protocol.enabledFromConfig({}), false);
    assert.equal(protocol.roomFromConfig({fips: {room: "meshdrop-test"}}), "meshdrop-test");
    assert.equal(protocol.roomFromConfig({}), "meshdrop-fips");
});

test("FIPS discovery protocol summarizes unavailable status", () => {
    assert.deepEqual(
        protocol.summarizeStatus({enabled: true, available: false, error: "missing"}),
        {
            enabled: true,
            available: false,
            npub: "",
            ipv6Addr: "",
            peerCount: 0,
            meshSize: 0,
            room: "meshdrop-fips"
        }
    );
});

test("FIPS discovery protocol summarizes daemon status", () => {
    assert.deepEqual(
        protocol.summarizeStatus({
            enabled: true,
            available: true,
            npub: "npub1local",
            ipv6Addr: "fd00::1",
            peers: [{npub: "npub1peer"}],
            meshSize: 10,
            room: "meshdrop-test"
        }),
        {
            enabled: true,
            available: true,
            npub: "npub1local",
            ipv6Addr: "fd00::1",
            peerCount: 1,
            meshSize: 10,
            room: "meshdrop-test"
        }
    );
});
