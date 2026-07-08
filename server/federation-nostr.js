import {finalizeEvent} from "nostr-tools";
import {WebSocket} from "ws";

import {FederationNostrDiscoveryBase} from "./federation-nostr-base.js";
import {
    FEDERATION_KIND,
    FIPS_FEDERATION_PROTOCOL,
    POLLEN_FEDERATION_PROTOCOL,
    errorMessage,
    noop
} from "./federation-nostr-protocol.js";

export {
    FEDERATION_KIND,
    FIPS_FEDERATION_PROTOCOL,
    POLLEN_FEDERATION_PROTOCOL
} from "./federation-nostr-protocol.js";

export class FederationNostrDiscovery extends FederationNostrDiscoveryBase {

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
                this.trace(
                    "trusted npub set loaded",
                    `mode=${this.config.nostr.discoveryMode || "wot"}`,
                    `count=${this.config.nostr.recipientPubkeys.length}`,
                    `sample=${this.config.nostr.recipientPubkeys.slice(0, 3).map(pubkey => pubkey.slice(0, 8)).join(",") || "none"}`
                );
                this.trace("nostr relay open", relay, `filters=${filters.length}`);
                this.trace("nostr discovery subscription filters", JSON.stringify(filters.map(filter => this._filterSummary(filter))));
                this._sendRelaySubscription(socket, filters);
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
        const filters = [];
        const trusted = this.config.nostr.recipientPubkeys || [];
        for (let index = 0; index < trusted.length; index += 50) {
            filters.push({
                kinds: [FEDERATION_KIND],
                authors: trusted.slice(index, index + 50)
            });
        }
        if (this.config.nostr.pubkey && trusted.length) {
            filters.push({
                kinds: [FEDERATION_KIND],
                "#p": [this.config.nostr.pubkey]
            });
        }
        if (this._usesPublicNetwork()) {
            filters.push({
                kinds: [FEDERATION_KIND],
                "#d": [this.config.nostr.networkId]
            });
        }
        for (const roomId of this._activeRoomIds()) {
            filters.push({
                kinds: [FEDERATION_KIND],
                "#d": [roomId]
            });
        }
        return this._dedupeObjects(filters);
    }

    async announcePollen(socket = null) {
        if (!this.config.nostr.enabled || !this.config.pollen.enabled) return;
        const scopes = this._discoveryScopes("pollen");
        if (!scopes.length) {
            this._traceAnnouncementSkip("pollen nostr announce skipped", "no-client-trusted-or-public-discovery");
            return;
        }

        const identity = await this.getPollenIdentity();
        if (identity.needsInvite) {
            return this._announcePollenJoinRequest(identity, socket, scopes);
        }
        if (this.config.pollen.clusterBootstrap && !identity.hasMembership) return;

        for (const scope of scopes) {
            const event = finalizeEvent({
                kind: FEDERATION_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ...this._baseDiscoveryTags("pollen-federation", POLLEN_FEDERATION_PROTOCOL, scope),
                    ["service", this.config.pollen.serviceName],
                    ["room", scope.room],
                    ["capability", "meshdrop-pollen-service"],
                    ...this._pollenIdentityTags(identity)
                ],
                content: ""
            }, this.config.nostr.secretKey);

            this._publishEvent("pollen nostr announce", event, socket, this.config.pollen.serviceName, scope);
        }
    }

    async announceFips(socket = null) {
        const baseUrl = this.getFipsBaseUrl();
        if (!this.config.nostr.enabled || !this.config.fips.enabled || !baseUrl) return;
        const scopes = this._discoveryScopes("fips");
        if (!scopes.length) {
            this._traceAnnouncementSkip("fips nostr announce skipped", "no-client-trusted-or-public-discovery");
            return;
        }

        for (const scope of scopes) {
            const event = finalizeEvent({
                kind: FEDERATION_KIND,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ...this._baseDiscoveryTags("fips-federation", FIPS_FEDERATION_PROTOCOL, scope),
                    ["base", baseUrl],
                    ["capability", "meshdrop-http"],
                    ["room", scope.room]
                ],
                content: ""
            }, this.config.nostr.secretKey);

            this._publishEvent("fips nostr announce", event, socket, baseUrl, scope);
        }
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
        if (!event?.id) return;
        if (this.seenEvents.has(event.id)) {
            this.trace("nostr discovery event", "accepted=false", "reason=duplicate", `pubkey=${event.pubkey?.slice(0, 8) || "unknown"}`);
            return;
        }
        this.seenEvents.add(event.id);

        const decision = this._eventDecision(event);
        this.trace(
            "nostr discovery event",
            `accepted=${decision.accepted}`,
            `reason=${decision.reason}`,
            `type=${this._tag(event, "type") || "unknown"}`,
            `pubkey=${event.pubkey?.slice(0, 8) || "unknown"}`
        );
        if (!decision.accepted) return;

        const type = this._tag(event, "type");
        if (type === "pollen-join-request") {
            await this._handlePollenJoinRequest(event);
            return;
        }
        if (type === "pollen-invite") {
            await this._handlePollenInvite(event);
            return;
        }
        if (type !== "pollen-federation" && type !== "fips-federation") return;

        const serverId = this._tag(event, "server");
        if (!serverId || serverId === this.config.serverId) return;

        if (type === "fips-federation") {
            await this._handleFipsFederationEvent(event, serverId);
            return;
        }
        await this._handlePollenFederationEvent(event, serverId);
    }

    async _handleFipsFederationEvent(event, serverId) {
        const baseUrl = this._tag(event, "base") || this._tag(event, "url");
        if (!baseUrl) return;
        if (this._isFailureSuppressed("fips", baseUrl)) {
            this.trace("fips nostr suppressed", baseUrl);
            return;
        }

        this.trace("fips nostr event", `server=${serverId}`, `baseUrl=${baseUrl}`, `pubkey=${event.pubkey}`);
        await this.discoverHttpServer({serverId, transport: "fips", baseUrl}).catch(error => {
            this._rememberFailure("fips", baseUrl);
            this.reportError("FIPS federation Nostr discovery failed", baseUrl, errorMessage(error));
        });
    }

    async _handlePollenFederationEvent(event, serverId) {
        const serviceName = this._tag(event, "service");
        if (!serviceName) return;
        const remoteRoot = this._tag(event, "pln-root");
        const localIdentity = await this.getPollenIdentity();
        if (localIdentity.rootHash && !remoteRoot) {
            this.trace("pollen cluster unknown", `server=${serverId}`, `service=${serviceName}`);
            return;
        }
        if (remoteRoot && localIdentity.rootHash && remoteRoot !== localIdentity.rootHash) {
            this.trace(
                "pollen cluster mismatch",
                `server=${serverId}`,
                `remoteRoot=${remoteRoot.slice(0, 12)}`,
                `localRoot=${localIdentity.rootHash.slice(0, 12)}`
            );
            return;
        }
        if (this._isFailureSuppressed("pollen", serviceName)) {
            this.trace("pollen connect suppressed", serviceName);
            return;
        }

        this.trace("pollen nostr event", `server=${serverId}`, `service=${serviceName}`, `pubkey=${event.pubkey}`);
        await this.connectPollenService(serverId, serviceName).catch(error => {
            this._rememberFailure("pollen", serviceName);
            this.reportError("Pollen federation connect failed", serviceName, errorMessage(error));
        });
    }
}
