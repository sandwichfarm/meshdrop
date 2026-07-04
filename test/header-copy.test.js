import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("WEB-RTC toggle tooltips do not describe the control as Nostr relay discovery", async () => {
    const locale = JSON.parse(await readFile(new URL("../public/lang/en.json", import.meta.url), "utf8"));

    assert.equal(locale.header["nostr-mesh-connect_title"], "Discover peers over WEB-RTC");
    assert.equal(locale.header["nostr-mesh-disconnect_title"], "Stop WEB-RTC peer discovery");
});
