const NostrDiscoveryProtocol = {
    bootstrapRelays: ["wss://purplepag.es", "wss://nos.lol"],
    rtcAnnouncementRelays: ["wss://bucket.coracle.social"],
    profileKind: 0,
    contactListKind: 3,
    relayListKind: 10002,
    blossomServerListKind: 10063,
    pubkeyRegex: /^[0-9a-f]{64}$/i,

    normalizeRelayUrls(relays) {
        return [...new Set((relays || [])
            .map(relay => typeof relay === "string" ? relay.trim().replace(/\/+$/, "") : "")
            .filter(relay => /^wss?:\/\/[^/\s]+/.test(relay)))];
    },

    relayListFromEvent(event) {
        const relayUrls = {read: [], write: []};
        if (!event || event.kind !== this.relayListKind || !Array.isArray(event.tags)) return relayUrls;

        for (const tag of event.tags) {
            if (tag[0] !== "r" || !tag[1]) continue;

            const marker = tag[2];
            if (!marker || marker === "read") relayUrls.read.push(tag[1]);
            if (!marker || marker === "write") relayUrls.write.push(tag[1]);
        }

        return {
            read: this.normalizeRelayUrls(relayUrls.read),
            write: this.normalizeRelayUrls(relayUrls.write)
        };
    },

    profileFromEvent(event) {
        if (!event || event.kind !== this.profileKind || typeof event.content !== "string") return null;

        let metadata;
        try {
            metadata = JSON.parse(event.content);
        } catch {
            return null;
        }

        const displayName = this.sanitizeText(metadata.display_name || metadata.displayName || metadata.name);
        const picture = this.sanitizeUrl(metadata.picture || metadata.image);

        if (!displayName && !picture) return null;

        return {
            displayName,
            picture,
            metadata
        };
    },

    followPubkeysFromEvent(event) {
        if (!event || event.kind !== this.contactListKind || !Array.isArray(event.tags)) return [];

        return [...new Set(event.tags
            .filter(tag => tag[0] === "p" && this.pubkeyRegex.test(tag[1] || ""))
            .map(tag => tag[1].toLowerCase()))];
    },

    followListFromEvent(event) {
        return {
            found: !!event,
            pubkeys: this.followPubkeysFromEvent(event)
        };
    },

    blossomServerUrlsFromEvent(event) {
        if (!event || event.kind !== this.blossomServerListKind || !Array.isArray(event.tags)) return [];

        return [...new Set(event.tags
            .filter(tag => tag[0] === "server" && tag[1])
            .map(tag => tag[1].trim().replace(/\/+$/, ""))
            .filter(server => /^https?:\/\/[^/\s]+/.test(server)))];
    },

    blossomServerListFromEvent(event) {
        return {
            found: !!event,
            servers: this.blossomServerUrlsFromEvent(event)
        };
    },

    sanitizeText(value) {
        if (typeof value !== "string") return "";

        return value
            .replace(/[\x00-\x1F\x7F]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 64);
    },

    sanitizeUrl(value) {
        if (typeof value !== "string") return "";

        const trimmed = value.trim();
        try {
            const url = new URL(trimmed);
            return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
        } catch {
            return "";
        }
    },

    latestEvent(events, kind, pubkey) {
        return events
            .filter(event => event?.kind === kind && event.pubkey === pubkey)
            .sort((left, right) => (right.created_at || 0) - (left.created_at || 0))[0] || null;
    }
};

const RelaySettingsPreferences = {
    storageKey: "meshdrop_relay_settings",

    defaults() {
        return {
            bootstrapRelays: NostrDiscoveryProtocol.bootstrapRelays,
            webRtcRelays: NostrDiscoveryProtocol.rtcAnnouncementRelays,
            inboxRelays: NostrDiscoveryProtocol.bootstrapRelays,
            outboxRelays: NostrDiscoveryProtocol.bootstrapRelays
        };
    },

    read() {
        if (typeof localStorage === "undefined") return {};

        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || {};
        } catch {
            return {};
        }
    },

    write(settings) {
        const normalized = this.normalize(settings);
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(this.storageKey, JSON.stringify(normalized));
        }
        globalThis.Events?.fire?.("relay-settings-changed", normalized);
        return normalized;
    },

    normalize(settings = {}) {
        const defaults = this.defaults();
        return {
            bootstrapRelays: this.normalizeRelays(settings.bootstrapRelays, defaults.bootstrapRelays),
            webRtcRelays: this.normalizeRelays(settings.webRtcRelays, defaults.webRtcRelays),
            inboxRelays: this.normalizeRelays(settings.inboxRelays, defaults.inboxRelays),
            outboxRelays: this.normalizeRelays(settings.outboxRelays, defaults.outboxRelays)
        };
    },

    normalizeRelays(relays, fallback = []) {
        const normalized = NostrDiscoveryProtocol.normalizeRelayUrls(Array.isArray(relays) ? relays : []);
        return normalized.length ? normalized : NostrDiscoveryProtocol.normalizeRelayUrls(fallback);
    },

    bootstrapRelays(fallback = NostrDiscoveryProtocol.bootstrapRelays) {
        return this.normalizeRelays(this.read().bootstrapRelays, fallback);
    },

    webRtcRelays(fallback = NostrDiscoveryProtocol.rtcAnnouncementRelays) {
        return this.normalizeRelays(this.read().webRtcRelays, fallback);
    },

    relayListTags(readRelays, writeRelays) {
        return [
            ...this.normalizeRelays(readRelays).map(relay => ["r", relay, "read"]),
            ...this.normalizeRelays(writeRelays).map(relay => ["r", relay, "write"])
        ];
    }
};

class NostrRelayPool {

    constructor({bootstrapRelays = NostrDiscoveryProtocol.bootstrapRelays, timeoutMs = 1800} = {}) {
        this._defaultBootstrapRelays = NostrDiscoveryProtocol.normalizeRelayUrls(bootstrapRelays);
        this.bootstrapRelays = RelaySettingsPreferences.bootstrapRelays(this._defaultBootstrapRelays);
        this.timeoutMs = timeoutMs;
        this._relayLists = new Map();
        this._profiles = new Map();
        this._followLists = new Map();
        this._blossomServers = new Map();
        globalThis.Events?.on?.("relay-settings-changed", _ => this.refreshSettings());
    }

    refreshSettings() {
        this.bootstrapRelays = RelaySettingsPreferences.bootstrapRelays(this._defaultBootstrapRelays);
        this._relayLists.clear();
        this._profiles.clear();
        this._followLists.clear();
        this._blossomServers.clear();
    }

    async lookupUser(pubkey) {
        const relays = await this.getUserRelays(pubkey);
        const [profile, followList, blossomServerList] = await Promise.all([
            this.getUserProfile(pubkey, relays.write),
            this.getUserFollowList(pubkey, relays.write),
            this.getUserBlossomServerList(pubkey, relays.write)
        ]);

        return {
            relays,
            profile,
            followPubkeys: followList.pubkeys,
            followList,
            blossomServers: blossomServerList.servers,
            blossomServerList
        };
    }

    async getUserRelays(pubkey) {
        if (this._relayLists.has(pubkey)) return this._relayLists.get(pubkey);

        const event = await this.fetchLatestEvent(this.bootstrapRelays, {
            kinds: [NostrDiscoveryProtocol.relayListKind],
            authors: [pubkey],
            limit: 1
        });
        const parsed = NostrDiscoveryProtocol.relayListFromEvent(event);
        const relays = {
            read: parsed.read.length ? parsed.read : this.bootstrapRelays,
            write: parsed.write.length ? parsed.write : this.bootstrapRelays
        };

        this._relayLists.set(pubkey, relays);
        return relays;
    }

    async getUserProfile(pubkey, relayUrls = null) {
        if (this._profiles.has(pubkey)) return this._profiles.get(pubkey);

        const event = await this.fetchLatestEvent(relayUrls || this.bootstrapRelays, {
            kinds: [NostrDiscoveryProtocol.profileKind],
            authors: [pubkey],
            limit: 1
        });
        const profile = NostrDiscoveryProtocol.profileFromEvent(event);

        this._profiles.set(pubkey, profile);
        return profile;
    }

    async getUserFollowList(pubkey, relayUrls = null) {
        if (this._followLists.has(pubkey)) return this._followLists.get(pubkey);

        const event = await this.fetchLatestEvent(relayUrls || this.bootstrapRelays, {
            kinds: [NostrDiscoveryProtocol.contactListKind],
            authors: [pubkey],
            limit: 1
        });
        const list = NostrDiscoveryProtocol.followListFromEvent(event);
        const status = list.found ? "found" : "missing";
        const followList = {status, pubkeys: list.pubkeys};

        this._followLists.set(pubkey, followList);
        return followList;
    }

    async getUserBlossomServers(pubkey, relayUrls = null) {
        return (await this.getUserBlossomServerList(pubkey, relayUrls)).servers;
    }

    async getUserBlossomServerList(pubkey, relayUrls = null) {
        if (this._blossomServers.has(pubkey)) return this._blossomServers.get(pubkey);

        const event = await this.fetchLatestEvent(relayUrls || this.bootstrapRelays, {
            kinds: [NostrDiscoveryProtocol.blossomServerListKind],
            authors: [pubkey],
            limit: 1
        });
        const list = NostrDiscoveryProtocol.blossomServerListFromEvent(event);
        const status = list.found && list.servers.length ? "found" : "missing";
        const serverList = {status, servers: list.servers};

        this._blossomServers.set(pubkey, serverList);
        return serverList;
    }

    async fetchLatestEvent(relayUrls, filter) {
        const events = await this.fetchEvents(relayUrls, filter);
        return NostrDiscoveryProtocol.latestEvent(events, filter.kinds?.[0], filter.authors?.[0]);
    }

    async fetchEvents(relayUrls, filter) {
        if (globalThis.__meshdropDisableNostrRelayNetwork) return [];
        if (typeof WebSocket !== "function") return [];

        const relays = NostrDiscoveryProtocol.normalizeRelayUrls(relayUrls);
        const results = await Promise.allSettled(relays.map(relayUrl => this.fetchEventsFromRelay(relayUrl, filter)));
        return results
            .filter(result => result.status === "fulfilled")
            .flatMap(result => result.value);
    }

    fetchEventsFromRelay(relayUrl, filter) {
        return new Promise(resolve => {
            const socket = new WebSocket(relayUrl);
            const events = [];
            const subscriptionId = `meshdrop-${Math.random().toString(36).slice(2)}`;
            const finish = () => {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                clearTimeout(timer);
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
                resolve(events);
            };
            const timer = setTimeout(finish, this.timeoutMs);

            socket.onopen = () => socket.send(JSON.stringify(["REQ", subscriptionId, filter]));
            socket.onerror = finish;
            socket.onclose = finish;
            socket.onmessage = message => {
                let relayMessage;
                try {
                    relayMessage = JSON.parse(message.data);
                } catch {
                    return;
                }

                if (relayMessage[0] === "EVENT" && relayMessage[1] === subscriptionId) events.push(relayMessage[2]);
                if (relayMessage[0] === "EOSE" && relayMessage[1] === subscriptionId) finish();
            };
        });
    }

    async publishEvent(relayUrls, event) {
        if (globalThis.__meshdropDisableNostrRelayNetwork) return {attempted: 0, accepted: 0};
        if (typeof WebSocket !== "function") return {attempted: 0, accepted: 0};

        const relays = NostrDiscoveryProtocol.normalizeRelayUrls(relayUrls);
        const results = await Promise.allSettled(relays.map(relayUrl => this.publishEventToRelay(relayUrl, event)));
        return {
            attempted: relays.length,
            accepted: results.filter(result => result.status === "fulfilled" && result.value).length
        };
    }

    publishEventToRelay(relayUrl, event) {
        return new Promise(resolve => {
            const socket = new WebSocket(relayUrl);
            const finish = accepted => {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                clearTimeout(timer);
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
                resolve(accepted);
            };
            const timer = setTimeout(() => finish(false), this.timeoutMs);

            socket.onopen = () => socket.send(JSON.stringify(["EVENT", event]));
            socket.onerror = () => finish(false);
            socket.onclose = () => finish(false);
            socket.onmessage = message => {
                let relayMessage;
                try {
                    relayMessage = JSON.parse(message.data);
                } catch {
                    return;
                }

                if (relayMessage[0] === "OK" && relayMessage[1] === event.id) {
                    finish(relayMessage[2] !== false);
                }
            };
        });
    }
}

globalThis.NostrDiscoveryProtocol = NostrDiscoveryProtocol;
globalThis.RelaySettingsPreferences = RelaySettingsPreferences;
globalThis.NostrRelayPool = NostrRelayPool;
globalThis.meshdropNostrRelays = new NostrRelayPool();

const NostrFollowPolicy = {
    followSet(identity) {
        return new Set((identity?.followPubkeys || [])
            .filter(pubkey => NostrDiscoveryProtocol.pubkeyRegex.test(pubkey || ""))
            .map(pubkey => pubkey.toLowerCase()));
    },

    followListReady(identity) {
        return identity?.followListStatus === "found" || identity?.followListStatus === "missing";
    },

    allowsPubkey(pubkey, identity) {
        if (!identity) return false;
        if (!NostrDiscoveryProtocol.pubkeyRegex.test(pubkey || "")) return false;
        if (!this.followListReady(identity)) return false;

        return this.followSet(identity).has(pubkey.toLowerCase());
    },

    allowsPeer(peer, roomType = null, identity = globalThis.meshdropNostrIdentity?.getIdentity?.()) {
        const peerPubkey = peer?.nostrIdentity?.pubkey || (roomType === "nostr" ? peer?.id : "");
        if (!peerPubkey) return roomType !== "nostr";
        if (!identity) return roomType !== "nostr";

        return this.allowsPubkey(peerPubkey, identity);
    }
};

globalThis.NostrFollowPolicy = NostrFollowPolicy;

const ProtocolServerPreferences = {
    storageKey: "meshdrop_protocol_server_preferences",
    protocols: ["blossom", "hashtree"],

    normalizeServers(servers) {
        return [...new Set((servers || [])
            .map(server => typeof server === "string" ? server.trim().replace(/\/+$/, "") : "")
            .filter(server => /^https?:\/\/[^/\s]+/.test(server)))];
    },

    read() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || {};
        } catch {
            return {};
        }
    },

    write(preferences) {
        localStorage.setItem(this.storageKey, JSON.stringify(preferences));
        Events.fire("protocol-server-preferences-changed", preferences);
    },

    serverPreferences(serverUrl) {
        const preferences = this.read()[serverUrl] || {};
        return {
            blossom: preferences.blossom !== false,
            hashtree: preferences.hashtree !== false
        };
    },

    protocolEnabled(serverUrl, protocol) {
        return this.serverPreferences(serverUrl)[protocol] !== false;
    },

    setProtocolEnabled(serverUrl, protocol, enabled) {
        if (!this.protocols.includes(protocol)) return;

        const preferences = this.read();
        preferences[serverUrl] = {
            ...this.serverPreferences(serverUrl),
            [protocol]: !!enabled
        };
        this.write(preferences);
    },

    selectedServers(protocol, servers) {
        return this.normalizeServers(servers)
            .filter(server => this.protocolEnabled(server, protocol));
    }
};

globalThis.ProtocolServerPreferences = ProtocolServerPreferences;
