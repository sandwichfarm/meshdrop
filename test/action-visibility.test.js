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
const buttons = new Map();
let storedIdentity = null;

globalThis.window = globalThis;
globalThis.__meshdropDisableNostrRelayNetwork = true;
globalThis.location = {origin: "https://meshdrop.test"};
globalThis.Localization = {getTranslation(key) { return key; }};
globalThis.localStorage = {
    getItem(key) {
        return key === "meshdrop_nostr_identity" ? storedIdentity : null;
    },
    setItem(key, value) {
        if (key === "meshdrop_nostr_identity") storedIdentity = value;
    },
    removeItem(key) {
        if (key === "meshdrop_nostr_identity") storedIdentity = null;
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

await import("../public/scripts/nostr-relays.js");
await import("../public/scripts/nostr-identity.js");
await import("../public/scripts/local-discovery.js");
await import("../public/scripts/nostr-mesh.js");
await import("../public/scripts/blossom-transfer.js");
await import("../public/scripts/hashtree-transfer.js");
await import("../public/scripts/fips-discovery.js");

function resetUi() {
    listeners.clear();
    buttons.clear();
    storedIdentity = null;
    delete globalThis.nostr;
    [
        "nostr-identity",
        "local-discovery",
        "nostr-mesh",
        "blossom-transfer",
        "hashtree-transfer",
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

    assert.equal(buttons.get("nostr-identity").hasAttribute("hidden"), true);
    assert.equal(buttons.get("nostr-mesh").hasAttribute("hidden"), true);
    assert.equal(buttons.get("blossom-transfer").hasAttribute("hidden"), true);
    assert.equal(buttons.get("hashtree-transfer").hasAttribute("hidden"), true);
});

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
        assert.deepEqual(fired.slice(-1), ["join-ip-room"]);

        controller.setEnabled(false);
        assert.deepEqual(fired.slice(-1), ["leave-ip-room"]);
    } finally {
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

test("FIPS action stays hidden until status confirms the daemon is reachable", async () => {
    resetUi();
    const controller = new globalThis.FipsDiscoveryController();

    await controller._onConfig({fips: {enabled: true, room: "meshdrop-test"}});
    assert.equal(buttons.get("fips-discovery").hasAttribute("hidden"), true);

    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
            enabled: true,
            available: true,
            room: "meshdrop-test",
            peers: []
        })
    });

    await controller._onConfig({fips: {enabled: true, room: "meshdrop-test"}});
    assert.equal(buttons.get("fips-discovery").hasAttribute("hidden"), false);
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
                room: "meshdrop-test",
                peers: []
            })
        };
    };
    globalThis.Events.on("join-fips-room", () => {
        joinRequests += 1;
    });

    controller._config = {fips: {enabled: true, room: "meshdrop-test"}};
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
        room: "meshdrop-test",
        peers: []
    });

    assert.equal(button.classes.has("connecting"), false);
    assert.equal(button.classes.has("selected"), true);
    assert.equal(button.getAttribute("aria-busy"), "false");
    assert.equal(button.getAttribute("data-badge"), "4");
});
