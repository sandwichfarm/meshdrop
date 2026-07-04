import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {crypto: globalThis.crypto};

await import("../public/scripts/ui-main.js");

const protocol = globalThis.FooterDiscoveryProtocol;

test("footer discovery badges summarize enabled discovery mechanisms", () => {
    assert.deepEqual(protocol.badges({}).map(badge => badge.id), ["none"]);
    assert.deepEqual(
        protocol.badges({local: true, webrtc: true, fips: true}).map(badge => badge.id),
        ["local", "webrtc", "fips"]
    );
});

test("footer discovery badges include paired and public room state", () => {
    assert.deepEqual(
        protocol.badges({paired: true, publicRoomId: "abcde"}),
        [
            {id: "paired", selector: "secret"},
            {id: "public-room", selector: "public-id", roomId: "ABCDE"}
        ]
    );
});
