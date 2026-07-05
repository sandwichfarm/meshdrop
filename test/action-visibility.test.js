import test from "node:test";
import assert from "node:assert/strict";
import {nip19} from "nostr-tools";

class TestButton {
    constructor() {
        this.attributes = new Map([["hidden", ""]]);
        this.classes = new Set();
        this.classList = {
            add: name => this.classes.add(name),
            remove: name => this.classes.delete(name),
            contains: name => this.classes.has(name),
            toggle: (name, force) => {
                const shouldAdd = force === undefined ? !this.classes.has(name) : !!force;
                if (shouldAdd) this.classes.add(name);
                else this.classes.delete(name);
                return shouldAdd;
            }
        };
        this.title = "";
    }

    addEventListener() {}

    toggleAttribute(name, force) {
        if (force) {
            this.attributes.set(name, "");
        } else {
            this.attributes.delete(name);
        }
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }
}

const listeners = new Map();
const windowListeners = new Map();
const buttons = new Map();
let storedIdentity = null;
let storedValues = new Map();

globalThis.window = globalThis;
globalThis.__meshdropDisableNostrRelayNetwork = true;
globalThis.location = {origin: "https://meshdrop.test"};
globalThis.Localization = {getTranslation(key) { return key; }};
globalThis.localStorage = {
    getItem(key) {
        if (key === "meshdrop_nostr_identity") return storedIdentity;
        return storedValues.get(key) || null;
    },
    setItem(key, value) {
        if (key === "meshdrop_nostr_identity") storedIdentity = value;
        else storedValues.set(key, String(value));
    },
    removeItem(key) {
        if (key === "meshdrop_nostr_identity") storedIdentity = null;
        else storedValues.delete(key);
    }
};
globalThis.$ = id => buttons.get(id) || null;
globalThis.Events = {
    on(type, callback) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
    },
    fire(type, detail = {}) {
        for (const callback of listeners.get(type) || []) callback({detail});
    }
};
globalThis.addEventListener = (type, callback) => {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(callback);
};
globalThis.removeEventListener = (type, callback) => {
    const callbacks = windowListeners.get(type) || [];
    windowListeners.set(type, callbacks.filter(existing => existing !== callback));
};
globalThis.dispatchEvent = event => {
    for (const callback of windowListeners.get(event.type) || []) callback(event);
};

await import("../public/scripts/nostr-relays.js");
await import("../public/scripts/runtime-capabilities.js");
await import("../public/scripts/nostr-pubkey.js");
await import("../public/scripts/nostr-android-signer.js");
await import("../public/scripts/nostr-identity.js");
await import("../public/scripts/local-discovery.js");
await import("../public/scripts/nostr-mesh.js");
await import("../public/scripts/blossom-transfer.js");
await import("../public/scripts/hashtree-transfer.js");
await import("../public/scripts/pollen-transfer.js");
await import("../public/scripts/fips-discovery.js");

function resetUi() {
    listeners.clear();
    windowListeners.clear();
    buttons.clear();
    storedIdentity = null;
    storedValues = new Map();
    delete globalThis.nostr;
    delete globalThis.meshdropAndroidBridge;
    delete globalThis.WebSocket;
    delete globalThis.meshdropNostrIdentity;
    delete globalThis.meshdropNostrMesh;
    delete globalThis.meshdropBlossomTransfer;
    delete globalThis.meshdropHashtreeTransfer;
    delete globalThis.meshdropPollenTransfer;
    delete globalThis.meshdropFipsDiscovery;
    globalThis.window.isRtcSupported = true;
    [
        "nostr-identity",
        "local-discovery",
        "nostr-mesh",
        "blossom-transfer",
        "hashtree-transfer",
        "pollen-transfer",
        "fips-discovery"
    ].forEach(id => buttons.set(id, new TestButton()));
}

function installSigner(pubkey = "1".repeat(64)) {
    globalThis.nostr = {
        getPublicKey: async () => pubkey,
        signEvent: async event => ({
            ...event,
            pubkey,
            id: "2".repeat(64),
            sig: "3".repeat(128)
        }),
        nip04: {
            encrypt: async (_pubkey, plaintext) => plaintext,
            decrypt: async (_pubkey, ciphertext) => ciphertext
        }
    };
}

function installStoredIdentity(pubkey = "1".repeat(64)) {
    storedIdentity = JSON.stringify({
        pubkey,
        displayName: "Stored Nostr",
        picture: "",
        relays: {read: [], write: []},
        followPubkeys: [pubkey],
        followListStatus: "found",
        blossomServers: ["https://blossom.test"],
        blossomServerListStatus: "found",
        event: {
            id: "2".repeat(64),
            sig: "3".repeat(128),
            pubkey
        },
        androidSignerPackage: "com.greenart7c3.nostrsigner",
        verified: true
    });
}

function installOpenWebSocket() {
    const sockets = [];

    class TestWebSocket {
        static OPEN = 1;

        constructor(url) {
            this.url = url;
            this.readyState = TestWebSocket.OPEN;
            this.sent = [];
            sockets.push(this);
        }

        send(message) {
            this.sent.push(message);
        }

        close() {
            this.readyState = 3;
            this.onclose?.();
        }
    }

    globalThis.WebSocket = TestWebSocket;
    return sockets;
}

function installPublicKeyOnlySigner(pubkey = "4".repeat(64)) {
    globalThis.nostr = {
        getPublicKey: async () => pubkey,
        signEvent: async () => {
            throw new Error("signEvent rejected by test signer");
        }
    };
}

test("Nostr and storage actions stay hidden without a NIP-07 signer", () => {
    resetUi();

    new globalThis.NostrIdentityController();
    new globalThis.NostrMeshConnection();
    new globalThis.BlossomTransferController();
    new globalThis.HashtreeTransferController();
    new globalThis.PollenTransferController();

    assert.equal(buttons.get("nostr-identity").hasAttribute("hidden"), false);
    assert.equal(buttons.get("nostr-mesh").hasAttribute("hidden"), true);
    assert.equal(buttons.get("blossom-transfer").hasAttribute("hidden"), true);
    assert.equal(buttons.get("hashtree-transfer").hasAttribute("hidden"), true);
    assert.equal(buttons.get("pollen-transfer").hasAttribute("hidden"), true);
});

test("Nostr login uses Remote Signer directly when no browser signer exists", async () => {
    resetUi();
    const notifications = [];
    globalThis.Events.on("notify-user", event => notifications.push(event.detail));

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();

    assert.equal(buttons.get("nostr-identity").hasAttribute("hidden"), false);
    assert.equal(identity.getIdentity(), null);
    assert(notifications.includes("notifications.nostr-remote-signer-unavailable"));
});

test("Nostr login dialog is used when browser extension and remote signer are both possible", async () => {
    resetUi();
    installSigner();
    const choices = [];
    globalThis.meshdropNostrLoginDialog = {
        choose(methods) {
            choices.push(methods.map(method => method.id));
            return Promise.resolve("browser-extension");
        }
    };

    try {
        const identity = new globalThis.NostrIdentityController();
        await identity.connect();

        assert.deepEqual(choices, [["browser-extension", "remote-signer"]]);
        assert.equal(identity.getIdentity().pubkey, "1".repeat(64));
    }
    finally {
        delete globalThis.meshdropNostrLoginDialog;
    }
});

test("Nostr login dialog offers Amber when Android signer bridge is available", async () => {
    resetUi();
    const choices = [];
    globalThis.meshdropAndroidBridge = {
        isNostrSignerInstalled: () => true,
        requestNostrSigner: () => false
    };
    globalThis.meshdropNostrLoginDialog = {
        choose(methods) {
            choices.push(methods.map(method => method.id));
            return Promise.resolve("remote-signer");
        }
    };

    try {
        const identity = new globalThis.NostrIdentityController();
        await identity.connect();

        assert.deepEqual(choices, [["remote-signer", "android-signer"]]);
    }
    finally {
        delete globalThis.meshdropAndroidBridge;
        delete globalThis.meshdropNostrLoginDialog;
    }
});

test("Android signer-backed identity exposes NIP-04 encryption for Nostr mesh", async () => {
    resetUi();
    const pubkey = "5".repeat(64);
    const requests = [];
    globalThis.meshdropAndroidBridge = {
        isNostrSignerInstalled: () => true,
        requestNostrSigner(requestJson) {
            const request = JSON.parse(requestJson);
            requests.push(request);
            queueMicrotask(() => {
                const detail = androidSignerResult(request, pubkey);
                globalThis.dispatchEvent(new CustomEvent("android-nostr-signer-result", {detail}));
            });
            return true;
        }
    };
    globalThis.meshdropNostrLoginDialog = {
        choose() {
            return Promise.resolve("android-signer");
        }
    };

    try {
        const identity = new globalThis.NostrIdentityController();
        await identity.connect();

        assert.equal(identity.getIdentity().pubkey, pubkey);
        assert.equal(identity.getIdentity().androidSignerPackage, "com.greenart7c3.nostrsigner");
        assert.equal(identity.canEncrypt(), true);
        assert.equal(await identity.encryptTo("6".repeat(64), "hello"), "nip04_encrypt:hello");
        assert.equal(await identity.decryptFrom("6".repeat(64), "ciphertext"), "nip04_decrypt:ciphertext");
        assert.equal(requests.some(request => request.type === "get_public_key" && request.permissions.includes("nip04_encrypt")), true);
        assert.equal(requests.some(request => request.type === "nip04_encrypt" && request.pubkey === "6".repeat(64)), true);
        assert.equal(requests.some(request => request.type === "nip04_decrypt" && request.current_user === pubkey), true);
    }
    finally {
        delete globalThis.meshdropAndroidBridge;
        delete globalThis.meshdropNostrLoginDialog;
    }
});

test("Stored Android signer identity reuses Amber package for NIP-04 requests", async () => {
    resetUi();
    const pubkey = "9".repeat(64);
    const requests = [];
    installStoredIdentity(pubkey);
    globalThis.meshdropAndroidBridge = {
        isNostrSignerInstalled: () => true,
        requestNostrSigner(requestJson) {
            const request = JSON.parse(requestJson);
            requests.push(request);
            queueMicrotask(() => {
                globalThis.dispatchEvent(new CustomEvent("android-nostr-signer-result", {
                    detail: {id: request.id, result: `${request.type}:${request.payload}`}
                }));
            });
            return true;
        }
    };

    try {
        const identity = new globalThis.NostrIdentityController();

        assert.equal(identity.canEncrypt(), true);
        assert.equal(await identity.encryptTo("a".repeat(64), "hello"), "nip04_encrypt:hello");
        assert.equal(requests[0].package, "com.greenart7c3.nostrsigner");
        assert.equal(requests[0].current_user, pubkey);
    }
    finally {
        delete globalThis.meshdropAndroidBridge;
    }
});

function androidSignerResult(request, pubkey) {
    if (request.type === "get_public_key") {
        return {id: request.id, result: pubkey, package: "com.greenart7c3.nostrsigner"};
    }
    if (request.type === "sign_event") {
        return {
            id: request.id,
            event: JSON.stringify({
                ...JSON.parse(request.payload),
                pubkey,
                id: "7".repeat(64),
                sig: "8".repeat(128)
            })
        };
    }
    if (request.type === "nip04_encrypt" || request.type === "nip04_decrypt") {
        return {id: request.id, result: `${request.type}:${request.payload}`};
    }
    return {id: request.id, error: `unexpected request ${request.type}`};
}

test("Local discovery is enabled by default and toggles the IP room", () => {
    resetUi();
    const fired = [];
    const originalFire = globalThis.Events.fire;
    globalThis.Events.fire = (type, detail = {}) => {
        fired.push(type);
        originalFire(type, detail);
    };

    try {
        const controller = new globalThis.LocalDiscoveryController();

        assert.equal(controller.isEnabled(), true);
        assert.equal(buttons.get("local-discovery").classList.contains("selected"), true);
        assert.equal(buttons.get("local-discovery").getAttribute("aria-pressed"), "true");

        controller.setEnabled(false);
        assert.equal(controller.isEnabled(), false);
        assert.equal(buttons.get("local-discovery").classList.contains("selected"), false);

        controller.setEnabled(true);
        assert.equal(controller.isEnabled(), true);
        assert.equal(fired.includes("join-ip-room"), true);

        fired.length = 0;
        controller.setEnabled(false);
        assert.equal(fired.includes("leave-ip-room"), true);
    } finally {
        globalThis.Events.fire = originalFire;
    }
});

test("Local discovery rejoins after the server display-name handshake on each websocket connection", () => {
    resetUi();
    const fired = [];
    const originalFire = globalThis.Events.fire;
    globalThis.Events.fire = (type, detail = {}) => {
        fired.push(type);
        originalFire(type, detail);
    };

    try {
        const controller = new globalThis.LocalDiscoveryController();

        globalThis.Events.fire("ws-connected");
        assert.equal(fired.includes("join-ip-room"), false);

        globalThis.Events.fire("display-name", {displayName: "Device"});
        assert.equal(fired.includes("join-ip-room"), true);

        fired.length = 0;
        globalThis.Events.fire("ws-connected");
        globalThis.Events.fire("display-name", {displayName: "Device"});
        assert.equal(fired.includes("join-ip-room"), true);
        assert.equal(controller.isEnabled(), true);
    } finally {
        globalThis.Events.fire = originalFire;
    }
});

test("Local discovery does not rejoin after websocket reconnect when disabled", () => {
    resetUi();
    const fired = [];
    const originalFire = globalThis.Events.fire;
    globalThis.Events.fire = (type, detail = {}) => {
        fired.push(type);
        originalFire(type, detail);
    };

    try {
        const controller = new globalThis.LocalDiscoveryController();
        controller.setEnabled(false);
        fired.length = 0;

        globalThis.Events.fire("ws-connected");
        globalThis.Events.fire("display-name", {displayName: "Device"});
        assert.equal(fired.includes("join-ip-room"), false);
    } finally {
        globalThis.Events.fire = originalFire;
    }
});

test("Local discovery disable always asks the server to leave the IP room", () => {
    resetUi();
    const fired = [];
    const originalFire = globalThis.Events.fire;
    globalThis.Events.fire = (type, detail = {}) => {
        fired.push(type);
        originalFire(type, detail);
    };

    try {
        const controller = new globalThis.LocalDiscoveryController();

        controller.setEnabled(false);

        assert.equal(fired.includes("leave-ip-room"), true);
    } finally {
        globalThis.Events.fire = originalFire;
    }
});

test("Local discovery hides and disables itself when runtime has no backend", () => {
    resetUi();
    const fired = [];
    const originalFire = globalThis.Events.fire;
    globalThis.Events.fire = (type, detail = {}) => {
        fired.push(type);
        originalFire(type, detail);
    };

    try {
        const controller = new globalThis.LocalDiscoveryController();

        globalThis.Events.fire("config", {
            capabilities: {
                transports: {
                    localDiscovery: {supported: false}
                }
            }
        });

        assert.equal(controller.isEnabled(), false);
        assert.equal(buttons.get("local-discovery").hasAttribute("hidden"), true);
        assert.equal(fired.includes("leave-ip-room"), true);
    } finally {
        globalThis.Events.fire = originalFire;
    }
});

test("Nostr mesh selection is restored after refresh", async () => {
    resetUi();
    const pubkey = "a".repeat(64);
    installSigner(pubkey);
    installStoredIdentity(pubkey);
    const sockets = installOpenWebSocket();
    storedValues.set("meshdrop_nostr_mesh_enabled", "true");

    const identity = new globalThis.NostrIdentityController();
    const controller = new globalThis.NostrMeshConnection();

    try {
        globalThis.Events.fire("config", {nostrMesh: {relays: ["wss://relay.test"], room: "meshdrop"}});

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(identity.getIdentity().pubkey, pubkey);
        assert.equal(controller._active, true);
        assert.equal(buttons.get("nostr-mesh").classList.contains("selected"), true);
        assert.equal(sockets.length, 1);
    } finally {
        controller.disconnect(false, false);
    }
});

test("Blossom, Hashtree, and Pollen transfer selections are restored after refresh", async () => {
    resetUi();
    storedValues.set("meshdrop_blossom_transfer_enabled", "true");
    storedValues.set("meshdrop_hashtree_transfer_enabled", "true");
    storedValues.set("meshdrop_pollen_transfer_enabled", "true");
    globalThis.meshdropNostrIdentity = {
        getIdentity() {
            return {
                blossomServerListStatus: "found",
                blossomServers: ["https://blossom.test"]
            };
        }
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async url => {
        assert.equal(url, "pollen/status");
        return new Response(JSON.stringify({
            enabled: true,
            available: true,
            version: "v0.0.1-dev.21"
        }), {status: 200});
    };

    try {
        const blossom = new globalThis.BlossomTransferController();
        const hashtree = new globalThis.HashtreeTransferController();
        const pollen = new globalThis.PollenTransferController();
        globalThis.Events.fire("config", {
            blossom: {servers: ["https://blossom.test"]},
            pollen: {enabled: true}
        });

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(blossom.isActive(), true);
        assert.equal(hashtree.isActive(), true);
        assert.equal(pollen.isActive(), true);
        assert.equal(buttons.get("blossom-transfer").classList.contains("selected"), true);
        assert.equal(buttons.get("hashtree-transfer").classList.contains("selected"), true);
        assert.equal(buttons.get("pollen-transfer").classList.contains("selected"), true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("FIPS discovery selection is restored after refresh when daemon is available", async () => {
    resetUi();
    const fired = [];
    const originalFire = globalThis.Events.fire;
    const originalFetch = globalThis.fetch;
    storedValues.set("meshdrop_fips_discovery_enabled", "true");
    globalThis.fetch = async url => {
        assert.equal(url, "fips/status");
        return new Response(JSON.stringify({
            enabled: true,
            available: true,
            peerCount: 1,
            room: "npub-network:fips"
        }), {status: 200});
    };
    globalThis.Events.fire = (type, detail = {}) => {
        fired.push(type);
        originalFire(type, detail);
    };

    try {
        const controller = new globalThis.FipsDiscoveryController();
        await controller._onConfig({fips: {enabled: true, room: "npub-network:fips"}});

        assert.equal(fired.includes("join-fips-room"), true);
        globalThis.Events.fire("fips-status", {enabled: true, available: true, peerCount: 1});

        assert.equal(controller.isActive(), true);
        assert.equal(buttons.get("fips-discovery").classList.contains("selected"), true);
        assert.equal(fired.includes("notifications.fips-discovery-enabled"), false);
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.Events.fire = originalFire;
    }
});

test("Nostr sign-in appears with NIP-07 and dependent actions appear after sign-in", async () => {
    resetUi();
    installSigner();

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();
    new globalThis.NostrMeshConnection();
    new globalThis.BlossomTransferController();
    new globalThis.HashtreeTransferController();
    globalThis.Events.fire("config", {blossom: {servers: ["https://blossom.test"]}});

    assert.equal(buttons.get("nostr-identity").hasAttribute("hidden"), false);
    assert.equal(buttons.get("nostr-mesh").hasAttribute("hidden"), false);
    assert.equal(buttons.get("blossom-transfer").hasAttribute("hidden"), false);
    assert.equal(buttons.get("hashtree-transfer").hasAttribute("hidden"), false);
});

test("Nostr-dependent controls follow negotiated runtime capabilities", async () => {
    resetUi();
    installSigner();

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();
    const nostrMesh = new globalThis.NostrMeshConnection();
    const blossom = new globalThis.BlossomTransferController();
    const hashtree = new globalThis.HashtreeTransferController();

    globalThis.Events.fire("config", {
        blossom: {servers: ["https://blossom.test"]},
        capabilities: {
            transports: {
                webrtc: {supported: false},
                nostr: {supported: false},
                blossom: {supported: false},
                hashtree: {supported: false}
            }
        }
    });

    await nostrMesh.connect({notify: false});
    blossom.enable({notify: false});
    hashtree.enable({notify: false});

    assert.equal(buttons.get("nostr-mesh").hasAttribute("hidden"), true);
    assert.equal(buttons.get("blossom-transfer").hasAttribute("hidden"), true);
    assert.equal(buttons.get("hashtree-transfer").hasAttribute("hidden"), true);
    assert.equal(nostrMesh._active, false);
    assert.equal(blossom.isActive(), false);
    assert.equal(hashtree.isActive(), false);
});

test("FIPS and Pollen controls remain visible when configured but temporarily unavailable", async () => {
    resetUi();
    globalThis.fetch = async url => {
        if (url === "fips/status") {
            return {
                ok: true,
                json: async () => ({enabled: true, available: false})
            };
        }
        if (url === "pollen/status") {
            return {
                ok: true,
                json: async () => ({enabled: true, available: false})
            };
        }
        throw new Error(`unexpected fetch ${url}`);
    };

    try {
        const fips = new globalThis.FipsDiscoveryController();
        const pollen = new globalThis.PollenTransferController();
        await fips._onConfig({
            fips: {enabled: true, room: "npub-network:test"},
            capabilities: {transports: {fips: {supported: true}}}
        });
        await pollen._onConfig({
            pollen: {enabled: true, room: "npub-network:test"},
            capabilities: {transports: {pollen: {supported: true}}}
        });

        assert.equal(buttons.get("fips-discovery").hasAttribute("hidden"), false);
        assert.equal(buttons.get("pollen-transfer").hasAttribute("hidden"), false);
    }
    finally {
        delete globalThis.fetch;
    }
});

test("Nostr storage actions appear after sign-in even before Blossom servers are known", async () => {
    resetUi();
    installSigner();

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();
    new globalThis.BlossomTransferController();
    new globalThis.HashtreeTransferController();

    assert.deepEqual(identity.getIdentity().blossomServers, []);
    assert.equal(buttons.get("blossom-transfer").hasAttribute("hidden"), false);
    assert.equal(buttons.get("hashtree-transfer").hasAttribute("hidden"), false);
});

test("Nostr sign-in succeeds when auth event signing is rejected", async () => {
    resetUi();
    installPublicKeyOnlySigner();

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();

    assert.equal(identity.getIdentity().pubkey, "4".repeat(64));
    assert.equal(identity.getIdentity().displayName, "npub 44444444");
    assert.equal(identity.getIdentity().event, null);
    assert.equal(identity.getIdentity().verified, false);
    assert.equal(buttons.get("nostr-identity").hasAttribute("hidden"), false);
});

test("Nostr sign-in normalizes uppercase hex public keys", async () => {
    resetUi();
    installPublicKeyOnlySigner("A".repeat(64));

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();

    assert.equal(identity.getIdentity().pubkey, "a".repeat(64));
});

test("Nostr sign-in accepts npub public keys from permissive signers", async () => {
    resetUi();
    const hexPubkey = "5".repeat(64);
    installPublicKeyOnlySigner(nip19.npubEncode(hexPubkey));

    const identity = new globalThis.NostrIdentityController();
    await identity.connect();

    assert.equal(identity.getIdentity().pubkey, hexPubkey);
});

test("Nostr sign-in hydrates kind 0 profile and Blossom servers from outbox", async () => {
    resetUi();
    installSigner("6".repeat(64));
    const originalRelays = globalThis.meshdropNostrRelays;
    globalThis.meshdropNostrRelays = {
        async lookupUser(pubkey) {
            assert.equal(pubkey, "6".repeat(64));
            return {
                relays: {
                    read: ["wss://read.example"],
                    write: ["wss://write.example"]
                },
                profile: {
                    displayName: "Alice Nostr",
                    picture: "https://cdn.example/alice.png"
                },
                followPubkeys: ["8".repeat(64)],
                followList: {status: "found", pubkeys: ["8".repeat(64)]},
                blossomServers: ["https://blossom.example"]
            };
        }
    };

    try {
        const identity = new globalThis.NostrIdentityController();
        await identity.connect();
        await identity.hydrateIdentity();

        assert.equal(identity.getIdentity().displayName, "Alice Nostr");
        assert.equal(identity.getIdentity().picture, "https://cdn.example/alice.png");
        assert.deepEqual(identity.getIdentity().relays.write, ["wss://write.example"]);
        assert.equal(identity.getIdentity().followListStatus, "found");
        assert.deepEqual(identity.getIdentity().followPubkeys, ["8".repeat(64)]);
        assert.deepEqual(identity.getIdentity().blossomServers, ["https://blossom.example"]);
    } finally {
        globalThis.meshdropNostrRelays = originalRelays;
    }
});

test("Nostr server auth display name does not overwrite hydrated kind 0 profile name", async () => {
    resetUi();
    const pubkey = "7".repeat(64);
    installSigner(pubkey);
    const originalRelays = globalThis.meshdropNostrRelays;
    globalThis.meshdropNostrRelays = {
        async lookupUser() {
            return {
                relays: {read: [], write: []},
                profile: {
                    displayName: "Alice Nostr",
                    picture: "https://cdn.example/alice.png"
                },
                blossomServers: []
            };
        }
    };

    try {
        const identity = new globalThis.NostrIdentityController();
        await identity.connect();
        await identity.hydrateIdentity();

        globalThis.Events.fire("display-name", {
            displayName: "npub 77777777",
            nostrIdentity: {
                pubkey,
                displayName: "npub 77777777"
            }
        });

        assert.equal(identity.getIdentity().displayName, "Alice Nostr");
        assert.equal(identity.getIdentity().picture, "https://cdn.example/alice.png");
    } finally {
        globalThis.meshdropNostrRelays = originalRelays;
    }
});

test("FIPS action remains visible but unavailable until status confirms the daemon is reachable", async () => {
    resetUi();
    const controller = new globalThis.FipsDiscoveryController();

    await controller._onConfig({fips: {enabled: true, room: "npub-network:test"}});
    assert.equal(buttons.get("fips-discovery").hasAttribute("hidden"), false);
    assert.equal(buttons.get("fips-discovery").classList.contains("unavailable"), true);

    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            enabled: true,
            available: true,
            room: "npub-network:test",
            peers: []
        })
    });

    await controller._onConfig({fips: {enabled: true, room: "npub-network:test"}});
    assert.equal(buttons.get("fips-discovery").hasAttribute("hidden"), false);
    assert.equal(buttons.get("fips-discovery").classList.contains("unavailable"), false);
});

test("FIPS action shows icon connecting state until room join is confirmed", async () => {
    resetUi();
    const controller = new globalThis.FipsDiscoveryController();
    const button = buttons.get("fips-discovery");
    let resolveFetch;
    let joinRequests = 0;

    globalThis.meshdropPeerAvailabilityCounts = {fips: 4};
    globalThis.fetch = async () => {
        await new Promise(resolve => {
            resolveFetch = resolve;
        });
        return {
            ok: true,
            json: async () => ({
                enabled: true,
                available: true,
                room: "npub-network:test",
                peers: []
            })
        };
    };
    globalThis.Events.on("join-fips-room", () => {
        joinRequests += 1;
    });

    controller._config = {fips: {enabled: true, room: "npub-network:test"}};
    controller._available = true;
    controller._render();

    const enablePromise = controller.enable();
    await Promise.resolve();

    assert.equal(button.classes.has("connecting"), true);
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(button.hasAttribute("data-badge"), false);

    resolveFetch();
    await enablePromise;

    assert.equal(joinRequests, 1);
    assert.equal(button.classes.has("connecting"), true);
    assert.equal(button.hasAttribute("data-badge"), false);

    globalThis.Events.fire("fips-status", {
        enabled: true,
        available: true,
        room: "npub-network:test",
        peers: []
    });

    assert.equal(button.classes.has("connecting"), false);
    assert.equal(button.classes.has("selected"), true);
    assert.equal(button.getAttribute("aria-busy"), "false");
    assert.equal(button.getAttribute("data-badge"), "4");
});
