import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const runtimeCapabilitiesSource = fs.readFileSync(
    new URL("../public/scripts/runtime-capabilities.js", import.meta.url),
    "utf8"
);
const networkSource = fs.readFileSync(new URL("../public/scripts/network.js", import.meta.url), "utf8");

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function createContext({responses}) {
    const fired = [];
    const opened = [];
    const sockets = [];

    class TestXMLHttpRequest {
        constructor() {
            this.listeners = {};
            this.status = 0;
            this.responseText = "";
        }

        addEventListener(type, callback) {
            this.listeners[type] = callback;
        }

        open(method, url) {
            opened.push({method, url});
            this.url = url;
        }

        send() {
            const response = responses.shift() || {status: 404, body: ""};
            this.status = response.status;
            this.responseText = response.body || "";
            queueMicrotask(() => this.listeners.load?.());
        }
    }

    class TestWebSocket {
        constructor(url) {
            sockets.push(url);
        }
    }

    const context = {
        console: {log() {}, warn() {}, error() {}},
        setTimeout,
        clearTimeout,
        queueMicrotask,
        Date,
        Math,
        URL,
        XMLHttpRequest: TestXMLHttpRequest,
        WebSocket: TestWebSocket,
        window: {
            isRtcSupported: true,
            visibilityChangeEvent: "visibilitychange"
        },
        location: {protocol: "https:", host: "meshdrop.test", pathname: "/"},
        navigator: {onLine: true},
        sessionStorage: {getItem: () => null, setItem() {}},
        localStorage: {getItem: () => null},
        crypto: {randomUUID: () => "session"},
        Events: {
            on() {},
            fire(type, detail) {
                fired.push({type, detail});
            }
        },
        BrowserTabsConnector: {
            removePeerIdFromLocalStorage: () => Promise.resolve(),
            addPeerIdToLocalStorage: () => Promise.resolve("self")
        },
        PersistentStorage: {getAllRoomSecrets: () => Promise.resolve([])}
    };
    context.globalThis = context;

    vm.runInNewContext(
        `${runtimeCapabilitiesSource}\n${networkSource}\nglobalThis.__meshdropTest = {ServerConnection};`,
        context
    );

    return {context, fired, opened, sockets};
}

test("server connection falls back to static SPA config when backend config is unavailable", async () => {
    const {context, fired, opened, sockets} = createContext({
        responses: [
            {status: 404, body: ""},
            {status: 404, body: ""}
        ]
    });

    new context.__meshdropTest.ServerConnection();
    await flushPromises();
    await flushPromises();

    const configEvent = fired.find(event => event.type === "config");
    const wsConfigEvent = fired.find(event => event.type === "ws-config");

    assert.deepEqual(opened, [
        {method: "GET", url: "config"},
        {method: "GET", url: "/meshdrop-target.json"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "spa");
    assert.equal(configEvent.detail.capabilities.runtime.hasBackend, false);
    assert.equal(configEvent.detail.capabilities.transports.localDiscovery.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.fips.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.pollen.supported, false);
    assert.equal(configEvent.detail.capabilities.serverSettings.supported, false);
    assert.deepEqual(Object.keys(configEvent.detail.buttons), [
        "donation_button",
        "twitter_button",
        "mastodon_button",
        "bluesky_button",
        "custom_button",
        "privacypolicy_button"
    ]);
    assert.equal(wsConfigEvent.detail.wsFallback, false);
    assert.deepEqual(sockets, []);
});

test("server connection falls back to static SPA config when a static host serves HTML for config", async () => {
    const {context, fired, opened, sockets} = createContext({
        responses: [
            {status: 200, body: "<!doctype html><title>MeshDrop</title>"},
            {status: 404, body: ""}
        ]
    });

    new context.__meshdropTest.ServerConnection();
    await flushPromises();
    await flushPromises();

    const configEvent = fired.find(event => event.type === "config");

    assert.deepEqual(opened, [
        {method: "GET", url: "config"},
        {method: "GET", url: "/meshdrop-target.json"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "spa");
    assert.equal(configEvent.detail.capabilities.runtime.hasBackend, false);
    assert.deepEqual(sockets, []);
});

test("static config applies target manifest runtime metadata when present", async () => {
    const {context, fired, opened, sockets} = createContext({
        responses: [
            {status: 200, body: "<!doctype html><title>MeshDrop</title>"},
            {
                status: 200,
                body: JSON.stringify({
                    target: "desktop",
                    runtime: {
                        target: "desktop",
                        platform: "desktop",
                        hasBackend: false,
                        sharedInstance: false
                    },
                    transports: {
                        localDiscovery: false,
                        webrtc: true,
                        nostr: true,
                        blossom: true,
                        hashtree: true,
                        pollen: false,
                        fips: false
                    }
                })
            }
        ]
    });

    new context.__meshdropTest.ServerConnection();
    await flushPromises();
    await flushPromises();
    await flushPromises();

    const configEvent = fired.find(event => event.type === "config");

    assert.deepEqual(opened, [
        {method: "GET", url: "config"},
        {method: "GET", url: "/meshdrop-target.json"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "desktop");
    assert.equal(configEvent.detail.capabilities.runtime.platform, "desktop");
    assert.equal(configEvent.detail.capabilities.runtime.hasBackend, false);
    assert.equal(configEvent.detail.capabilities.transports.localDiscovery.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.nostr.supported, true);
    assert.equal(configEvent.detail.capabilities.transports.pollen.supported, false);
    assert.equal(configEvent.detail.capabilities.serverSettings.supported, false);
    assert.deepEqual(sockets, []);
});
