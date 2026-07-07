import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Nostr discovery tooltips do not describe relay signaling as the payload transport", async () => {
    const locale = JSON.parse(await readFile(new URL("../public/lang/en.json", import.meta.url), "utf8"));

    assert.equal(locale.header["nostr-mesh-connect_title"], "Use Nostr to discover direct clearnet WebRTC peers");
    assert.equal(locale.header["nostr-mesh-disconnect_title"], "Stop direct Nostr-signaled clearnet routing");
    assert.equal(locale.footer["webrtc-discovery"], "Nostr signal");
    assert.match(locale.footer["webrtc-discovery_title"], /Nostr is discovery and signaling/);
    assert.match(locale.footer["webrtc-discovery_title"], /direct clearnet WebRTC/);
});

test("header protocol toggles are grouped without visible text labels", async () => {
    const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

    const networkStart = html.indexOf('data-protocol-group="network"');
    const storageStart = html.indexOf('data-protocol-group="storage"');
    const settingsStart = html.indexOf('id="protocol-settings"');
    assert.notEqual(networkStart, -1);
    assert.notEqual(storageStart, -1);
    assert.notEqual(settingsStart, -1);
    assert(networkStart < storageStart);

    const network = html.slice(networkStart, storageStart);
    assert.match(network, /aria-label="Network postures"/);
    assert(network.indexOf('id="local-discovery"') < network.indexOf('id="fips-discovery"'));
    assert(network.indexOf('id="fips-discovery"') < network.indexOf('id="pollen-transfer"'));
    assert(network.indexOf('id="pollen-transfer"') < network.indexOf('id="nostr-mesh"'));
    assert.match(network, /id="nostr-mesh"[\s\S]+xlink:href="#wifi-tethering"/);
    assert.equal(network.includes("protocol-toggle-label"), false);

    const storage = html.slice(storageStart, settingsStart);
    assert.match(storage, /aria-label="Storage routes"/);
    assert(storage.indexOf('id="blossom-transfer"') < storage.indexOf('id="hashtree-transfer"'));
    assert.equal(storage.includes("protocol-toggle-label"), false);
    assert.equal(html.includes("protocol-toggle-group-label"), false);
});
