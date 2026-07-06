import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("relay discovery tooltips do not describe relay signaling as the payload transport", async () => {
    const locale = JSON.parse(await readFile(new URL("../public/lang/en.json", import.meta.url), "utf8"));

    assert.equal(locale.header["nostr-mesh-connect_title"], "Discover peers through Nostr relay signaling");
    assert.equal(locale.header["nostr-mesh-disconnect_title"], "Stop Nostr relay peer discovery");
    assert.match(locale.footer["webrtc-discovery_title"], /File bytes still use WebRTC/);
});

test("header protocol toggles are visibly grouped by role", async () => {
    const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

    const networkStart = html.indexOf('data-protocol-group="network"');
    const storageStart = html.indexOf('data-protocol-group="storage"');
    assert.notEqual(networkStart, -1);
    assert.notEqual(storageStart, -1);
    assert(networkStart < storageStart);

    const network = html.slice(networkStart, storageStart);
    assert.match(network, /protocol-toggle-group-label">Network</);
    assert(network.indexOf('id="local-discovery"') < network.indexOf('id="fips-discovery"'));
    assert(network.indexOf('id="fips-discovery"') < network.indexOf('id="pollen-transfer"'));
    assert(network.indexOf('id="pollen-transfer"') < network.indexOf('id="nostr-mesh"'));
    assert.match(network, /protocol-toggle-label">Instance</);
    assert.match(network, /protocol-toggle-label">FIPS</);
    assert.match(network, /protocol-toggle-label">Pollen</);
    assert.match(network, /protocol-toggle-label">Relay</);

    const storage = html.slice(storageStart);
    assert.match(storage, /protocol-toggle-group-label">Storage</);
    assert(storage.indexOf('id="blossom-transfer"') < storage.indexOf('id="hashtree-transfer"'));
    assert.match(storage, /protocol-toggle-label">Blossom</);
    assert.match(storage, /protocol-toggle-label">Hashtree</);
});
