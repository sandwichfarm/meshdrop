import {finalizeEvent, getPublicKey} from "nostr-tools";
import {WebSocket} from "ws";

export const FEDERATION_KIND = 20385;
export const FIPS_FEDERATION_PROTOCOL = "meshdrop-fips-nostr-discovery";
export const POLLEN_FEDERATION_PROTOCOL = "meshdrop-pollen-nostr-discovery";

const errorMessage = error => error?.message || String(error);
const noop = () => undefined;

export class FederationNostrDiscovery {

    constructor({
        config,
        trace = noop,
        getFipsBaseUrl = () => "",
        discoverHttpServer,
        connectPollenService,
        reportError = noop
    }) {
        this.config = config;
        this.trace = trace;
        this.getFipsBaseUrl = getFipsBaseUrl;
        this.discoverHttpServer = discoverHttpServer;
        this.connectPollenService = connectPollenService;
        this.reportError = reportError;
        this.relaySockets = new Map();
        this.seenEvents = new Set();
    }

    stop() {
        for (const socket of this.relaySockets.values()) socket.close();
        this.relaySockets.clear();
    }

    connectRelays() {
        for (const relay of this.config.nostr.relays) {
            if (this.relaySockets.has(relay)) continue;

            this.trace("nostr relay connect", relay);
            const socket = new WebSocket(relay);
            socket.onopen = () => {
                const filters = this.discoveryFilters();
                this.trace("nostr relay open", relay, `filters=${filters.length}`);
                socket.send(JSON.stringify(["REQ", `meshdrop-fed-${this.config.serverId}`, ...filters]));
                this.announceFips(socket).catch(noop);
                this.announcePollen(socket).catch(noop);
            };
            socket.onmessage = event => this.onRelayMessage(event.data);
            socket.onerror = error => this.reportError("MeshDrop federation Nostr relay error", relay, errorMessage(error));
            socket.onclose = () => {
                this.trace("nostr relay closed", relay);
                this.relaySockets.delete(relay);
            };
            this.relaySockets.set(relay, socket);
        }
    }

    discoveryFilters() {
        const filters = [{
            kinds: [FEDERATION_KIND],
            "#d": [this.config.nostr.networkId]
        }];
        if (this.config.nostr.pubkey) {
            filters.push({
                kinds: [FEDERATION_KIND],
                "#p": [this.config.nostr.pubkey]
            });
        }
        return filters;
    }

    async announcePollen(socket = null) {
        if (!this.config.nostr.enabled || !this.config.pollen.enabled) return;

        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", "pollen-federation"],
                ["protocol", POLLEN_FEDERATION_PROTOCOL],
                ["d", this.config.nostr.networkId],
                ...this.config.nostr.recipientPubkeys.map(pubkey => ["p", pubkey]),
                ["network", this.config.nostr.networkId],
                ["server", this.config.serverId],
                ["service", this.config.pollen.serviceName],
                ["room", this.config.pollen.room]
            ],
            content: ""
        }, this.config.nostr.secretKey);

        this._publishEvent("pollen nostr announce", event, socket, this.config.pollen.serviceName);
    }

    async announceFips(socket = null) {
        const baseUrl = this.getFipsBaseUrl();
        if (!this.config.nostr.enabled || !this.config.fips.enabled || !baseUrl) return;

        const event = finalizeEvent({
            kind: FEDERATION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["type", "fips-federation"],
                ["protocol", FIPS_FEDERATION_PROTOCOL],
                ["d", this.config.nostr.networkId],
                ...this.config.nostr.recipientPubkeys.map(pubkey => ["p", pubkey]),
                ["network", this.config.nostr.networkId],
                ["server", this.config.serverId],
                ["base", baseUrl],
                ["room", this.config.fips.room]
            ],
            content: ""
        }, this.config.nostr.secretKey);

        this._publishEvent("fips nostr announce", event, socket, baseUrl);
    }

    async onRelayMessage(rawMessage) {
        let message;
        try {
            message = JSON.parse(rawMessage);
        } catch {
            return;
        }

        if (message[0] !== "EVENT") return;
        const event = message[2];
        if (!event?.id || this.seenEvents.has(event.id)) return;
        this.seenEvents.add(event.id);

        if (event.pubkey === getPublicKey(this.config.nostr.secretKey)) return;
        const type = this._tag(event, "type");
        if (type !== "pollen-federation" && type !== "fips-federation") return;
        if (!this._isEventForThisNetwork(event)) return;

        const serverId = this._tag(event, "server");
        if (!serverId || serverId === this.config.serverId) return;

        if (type === "fips-federation") {
            const baseUrl = this._tag(event, "base") || this._tag(event, "url");
            if (!baseUrl) return;

            this.trace("fips nostr event", `server=${serverId}`, `baseUrl=${baseUrl}`, `pubkey=${event.pubkey}`);
            await this.discoverHttpServer({serverId, transport: "fips", baseUrl}).catch(error => {
                this.reportError("FIPS federation Nostr discovery failed", baseUrl, errorMessage(error));
            });
            return;
        }

        const serviceName = this._tag(event, "service");
        if (!serviceName) return;
        this.trace("pollen nostr event", `server=${serverId}`, `service=${serviceName}`, `pubkey=${event.pubkey}`);
        await this.connectPollenService(serverId, serviceName).catch(error => {
            this.reportError("Pollen federation connect failed", serviceName, errorMessage(error));
        });
    }

    _publishEvent(label, event, socket, target) {
        const message = JSON.stringify(["EVENT", event]);
        if (socket) {
            if (socket.readyState === WebSocket.OPEN) socket.send(message);
            this.trace(label, "socket", target, this.config.nostr.networkId);
            return;
        }

        for (const relaySocket of this.relaySockets.values()) {
            if (relaySocket.readyState === WebSocket.OPEN) relaySocket.send(message);
        }
        this.trace(label, `openRelays=${this._openRelayCount()}`, target, this.config.nostr.networkId);
    }

    _openRelayCount() {
        return [...this.relaySockets.values()].filter(relaySocket => relaySocket.readyState === WebSocket.OPEN).length;
    }

    _isEventForThisNetwork(event) {
        const eventNetwork = this._tag(event, "d") || this._tag(event, "network");
        if (eventNetwork && eventNetwork !== this.config.nostr.networkId) return false;
        return eventNetwork === this.config.nostr.networkId
            || this._hasTag(event, "p", this.config.nostr.pubkey);
    }

    _tag(event, name) {
        return event.tags?.find(tag => tag[0] === name)?.[1] || "";
    }

    _hasTag(event, name, value) {
        return (event.tags || []).some(tag => tag[0] === name && tag[1] === value);
    }
}
