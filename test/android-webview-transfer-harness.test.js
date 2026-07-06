import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
    connectAndroidNostrSource,
    initScriptSource
} from "../scripts/android-webview-transfer-harness.mjs";

test("Android WebView transfer harness prefers proof signer over installed Amber", async () => {
    const localStorage = new Map();
    const context = {
        localStorage: {
            setItem(key, value) {
                localStorage.set(key, value);
            }
        },
        location: {origin: "file://android_asset"},
        window: {
            addEventListener() {}
        },
        meshdropNostrLoginDialog: {
            async choose() {
                return "android-signer";
            }
        }
    };
    context.globalThis = context;

    vm.runInNewContext(initScriptSource({
        identity: {
            pubkey: "a".repeat(64),
            displayName: "Proof A",
            followPubkeys: ["b".repeat(64)]
        },
        relayUrls: ["ws://127.0.0.1:1234"],
        targetName: "android"
    }), context);

    const choice = await context.meshdropNostrLoginDialog.choose([
        {id: "remote-signer"},
        {id: "android-signer"},
        {id: "browser-extension"}
    ]);

    assert.equal(choice, "browser-extension");
    assert.equal(context.__meshdropProofIdentityPubkey, "a".repeat(64));
    assert.equal(typeof context.nostr.signEvent, "function");
    assert(localStorage.has("meshdrop_nostr_identity"));
});

test("Android WebView transfer harness replaces stale device identity", async () => {
    let identity = {pubkey: "old".padEnd(64, "0")};
    let disconnected = false;
    let connected = false;
    const context = {
        __meshdropProofIdentityPubkey: "new".padEnd(64, "0"),
        meshdropNostrIdentity: {
            getIdentity() {
                return identity;
            },
            disconnect() {
                disconnected = true;
                identity = null;
            },
            async connect() {
                connected = true;
                identity = {pubkey: context.__meshdropProofIdentityPubkey};
            }
        }
    };
    context.globalThis = context;

    const result = await vm.runInNewContext(connectAndroidNostrSource(), context);

    assert.equal(result, true);
    assert.equal(disconnected, true);
    assert.equal(connected, true);
    assert.equal(identity.pubkey, context.__meshdropProofIdentityPubkey);
});
