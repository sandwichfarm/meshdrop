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

function createContext({responses, protocol = "https:", bluetooth = null}) {
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
        location: {protocol, host: "meshdrop.test", pathname: "/"},
        navigator: {
            onLine: true,
            ...(bluetooth ? {bluetooth} : {})
        },
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
    assert.equal(configEvent.detail.capabilities.transports.tor.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.i2p.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.loki.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.bluetooth.supported, false);
    assert.equal(configEvent.detail.capabilities.transports.bluetooth.transferSupported, false);
    assert.equal(configEvent.detail.capabilities.transports.bluetooth.apiAvailable, false);
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

test("static config negotiates Web Bluetooth API presence without claiming transfer support", async () => {
    const {context, fired} = createContext({
        bluetooth: {requestDevice() {}},
        responses: [
            {status: 404, body: ""},
            {status: 404, body: ""}
        ]
    });

    new context.__meshdropTest.ServerConnection();
    await flushPromises();
    await flushPromises();

    const configEvent = fired.find(event => event.type === "config");
    const bluetooth = configEvent.detail.capabilities.transports.bluetooth;

    assert.equal(bluetooth.supported, false);
    assert.equal(bluetooth.transferSupported, false);
    assert.equal(bluetooth.apiAvailable, true);
    assert.equal(bluetooth.nativeBridgeAvailable, false);
    assert.equal(bluetooth.unavailableReason, "bluetooth-transfer-not-implemented");
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
    assert.equal(configEvent.detail.capabilities.transports.bluetooth.supported, false);
    assert.equal(configEvent.detail.capabilities.serverSettings.supported, false);
    assert.deepEqual(sockets, []);
});

test("static SPA config ignores backend-only FIPS Pollen and overlay claims in target metadata", async () => {
    const {context, fired, opened, sockets} = createContext({
        responses: [
            {status: 200, body: "<!doctype html><title>MeshDrop</title>"},
            {
                status: 200,
                body: JSON.stringify({
                    target: "spa",
                    nativeShellBuilt: true,
                    runtime: {
                        target: "spa",
                        platform: "browser",
                        hasBackend: false,
                        sharedInstance: false
                    },
                    transports: {
                        localDiscovery: true,
                        webrtc: true,
                        nostr: true,
                        blossom: true,
                        hashtree: true,
                        pollen: true,
                        fips: true,
                        tor: true,
                        i2p: true,
                        loki: true
                    },
                    capabilities: {
                        transports: {
                            fips: {supported: true},
                            pollen: {supported: true},
                            tor: {supported: true},
                            i2p: {supported: true},
                            loki: {supported: true}
                        }
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
    const transports = configEvent.detail.capabilities.transports;

    assert.deepEqual(opened, [
        {method: "GET", url: "config"},
        {method: "GET", url: "/meshdrop-target.json"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "spa");
    assert.equal(configEvent.detail.capabilities.runtime.hasBackend, false);
    assert.equal(transports.webrtc.supported, true);
    assert.equal(transports.nostr.supported, true);
    assert.equal(transports.localDiscovery.supported, false);
    assert.equal(configEvent.detail.fips.enabled, false);
    assert.equal(configEvent.detail.pollen.enabled, false);
    assert.equal(transports.fips.supported, false);
    assert.equal(transports.fips.unavailableReason, "requires-instance-native-route");
    assert.equal(transports.pollen.supported, false);
    assert.equal(transports.pollen.unavailableReason, "requires-instance-native-route");
    assert.equal(transports.tor.supported, false);
    assert.equal(transports.tor.unavailableReason, "requires-instance-native-route");
    assert.equal(transports.i2p.supported, false);
    assert.equal(transports.i2p.unavailableReason, "requires-instance-native-route");
    assert.equal(transports.loki.supported, false);
    assert.equal(transports.loki.unavailableReason, "requires-instance-native-route");
    assert.deepEqual(sockets, []);
});

test("file-origin static config reads packaged target manifest beside app directory", async () => {
    const {context, fired, opened, sockets} = createContext({
        protocol: "file:",
        responses: [
            {status: 0, body: ""},
            {
                status: 0,
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
                        fips: false,
                        bluetooth: false
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
        {method: "GET", url: "../meshdrop-target.json"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "desktop");
    assert.equal(configEvent.detail.capabilities.runtime.platform, "desktop");
    assert.equal(configEvent.detail.capabilities.runtime.hasBackend, false);
    assert.deepEqual(sockets, []);
});

test("static config uses native shell injected target manifest before xhr fallback", async () => {
    const {context, fired, opened, sockets} = createContext({
        responses: [
            {status: 0, body: ""}
        ]
    });
    context.__meshdropTargetManifest = {
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
            fips: false,
            bluetooth: false
        }
    };

    new context.__meshdropTest.ServerConnection();
    await flushPromises();
    await flushPromises();

    const configEvent = fired.find(event => event.type === "config");

    assert.deepEqual(opened, [
        {method: "GET", url: "config"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "desktop");
    assert.equal(configEvent.detail.capabilities.runtime.platform, "desktop");
    assert.deepEqual(sockets, []);
});

test("static config exposes Android APK FIPS and Pollen transport options", async () => {
    const {context, fired, opened, sockets} = createContext({
        responses: [
            {status: 0, body: ""}
        ]
    });
	context.__meshdropTargetManifest = {
		target: "android",
		nativeShellBuilt: true,
        runtime: {
            target: "android",
            platform: "mobile",
            hasBackend: false,
            sharedInstance: false
        },
        transports: {
            localDiscovery: false,
            webrtc: true,
            nostr: true,
            blossom: true,
            hashtree: true,
            pollen: true,
            fips: true,
			bluetooth: false
		}
	};
	context.__meshdropAndroidNativeBackend = {
		alive: true,
		baseUrl: "http://127.0.0.1:43210",
		fipsRustCore: false,
		pollenStore: "android-native"
	};

	new context.__meshdropTest.ServerConnection();
    await flushPromises();
    await flushPromises();

    const configEvent = fired.find(event => event.type === "config");

    assert.deepEqual(opened, [
        {method: "GET", url: "config"}
    ]);
    assert.equal(configEvent.detail.capabilities.runtime.target, "android");
    assert.equal(configEvent.detail.capabilities.runtime.platform, "mobile");
    assert.equal(configEvent.detail.capabilities.runtime.hasBackend, false);
    assert.equal(configEvent.detail.fips.enabled, true);
    assert.equal(configEvent.detail.pollen.enabled, true);
    assert.equal(configEvent.detail.capabilities.transports.fips.supported, true);
    assert.equal(configEvent.detail.capabilities.transports.pollen.supported, true);
    assert.deepEqual(sockets, []);
});
