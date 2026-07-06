import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("relay discovery tooltips do not describe relay signaling as the payload transport", async () => {
    const locale = JSON.parse(await readFile(new URL("../public/lang/en.json", import.meta.url), "utf8"));

    assert.equal(locale.header["nostr-mesh-connect_title"], "Discover peers through Nostr relay signaling");
    assert.equal(locale.header["nostr-mesh-disconnect_title"], "Stop Nostr relay peer discovery");
    assert.match(locale.footer["webrtc-discovery_title"], /File bytes still use WebRTC/);
});
