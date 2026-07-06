import test from "node:test";
import assert from "node:assert/strict";

const listeners = new Map();
const firedEvents = [];

function on(type, callback) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(callback);
}

function dispatch(type, detail = {}) {
    for (const callback of listeners.get(type) || []) callback({type, detail});
}

function installGlobals() {
    listeners.clear();
    firedEvents.length = 0;
    globalThis.window = globalThis;
    globalThis.$ = () => null;
    globalThis.$$ = () => null;
    globalThis.Localization = {getTranslation(key) { return key; }};
    globalThis.PersistentStorage = {};
    globalThis.BrowserTabsConnector = {};
    globalThis.NostrDiscoveryProtocol = {};
    globalThis.ProtocolServerPreferences = {};
    globalThis.RelaySettingsPreferences = {};
    globalThis.changeFavicon = () => {};
    globalThis.decodeBase64Files = async () => [];
    globalThis.decodeBase64Text = async value => value;
    globalThis.getThumbnailAsDataUrl = async () => "";
    globalThis.isUrlValid = () => true;
    globalThis.Events = {
        on,
        off(type, callback) {
            const callbacks = listeners.get(type) || [];
            listeners.set(type, callbacks.filter(existing => existing !== callback));
        },
        fire(type, detail = {}) {
            firedEvents.push({type, detail});
            dispatch(type, detail);
        }
    };
    globalThis.addEventListener = on;
    globalThis.removeEventListener = globalThis.Events.off;
    globalThis.dispatchEvent = event => dispatch(event.type, event.detail);
    globalThis.CustomEvent = class {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    };
    globalThis.atob = value => Buffer.from(value, "base64").toString("binary");
}

installGlobals();
await import(`../public/scripts/native-share-inbox.js?native-share-inbox-${Date.now()}`);

test("NativeShareInboxUI reads native share inbox files into share mode", async () => {
    installGlobals();
    const ui = new globalThis.NativeShareInboxUI();
    const inbox = {
        list: async () => [{name: "proof.txt", path: "proof-staged.txt", receivedAt: "2026-07-06T00:00:00Z"}],
        read: async name => ({
            name,
            base64: Buffer.from("ios share payload").toString("base64")
        })
    };

    const files = await ui.evaluate(await inbox.list(), inbox);

    assert.equal(files.length, 1);
    assert.equal(files[0].name, "proof.txt");
    assert.equal(files[0].type, "application/octet-stream");
    assert.equal(await files[0].text(), "ios share payload");
    assert.deepEqual(firedEvents.map(event => event.type), ["activate-share-mode"]);
    assert.deepEqual(firedEvents[0].detail.files, files);
});

test("NativeShareInboxUI ignores duplicate native share inbox events", async () => {
    installGlobals();
    const ui = new globalThis.NativeShareInboxUI();
    const entries = [{name: "proof.txt", path: "proof-staged.txt", receivedAt: "2026-07-06T00:00:00Z"}];
    const inbox = {
        list: async () => entries,
        read: async name => ({
            name,
            base64: Buffer.from("ios share payload").toString("base64")
        })
    };

    await ui.evaluate(entries, inbox);
    const duplicate = await ui.evaluate(entries, inbox);

    assert.deepEqual(duplicate, []);
    assert.equal(firedEvents.filter(event => event.type === "activate-share-mode").length, 1);
});
