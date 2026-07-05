class NostrIdentityController {

    constructor() {
        this.$button = globalThis.$("nostr-identity");
        this._identity = this._withServerListState(this.getStoredIdentity());
        this._signer = this._defaultSigner();
        this._signerAvailable = this.hasAnySigner();
        if (this._identity && !this.hasAnySigner()) {
            this._identity = null;
            localStorage.removeItem("meshdrop_nostr_identity");
        }

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        this._watchSignerAvailability();
        globalThis.Events.on("display-name", e => this._onServerDisplayName(e.detail));
        globalThis.meshdropNostrIdentity = this;
        globalThis.Events.fire("nostr-signer-available-changed", this._signerAvailable);
        if (this._identity) {
            this._setServerListStatus("loading", this._identity.blossomServers || [], false);
            globalThis.Events.fire("self-display-name-changed", this._identity);
            this.hydrateIdentity();
        }
    }

    getStoredIdentity() {
        const rawIdentity = localStorage.getItem("meshdrop_nostr_identity");
        if (!rawIdentity) return null;

        try {
            return JSON.parse(rawIdentity);
        } catch {
            localStorage.removeItem("meshdrop_nostr_identity");
            return null;
        }
    }

    async toggle() {
        if (this._identity) {
            this.disconnect();
            return;
        }

        await this.connect();
    }

    async connect() {
        const method = await this._chooseLoginMethod();
        if (!method) return;
        if (method === "remote-signer") {
            this._openRemoteSigner();
            return;
        }

        try {
            const signer = method === "android-signer"
                ? this._androidSigner()
                : this._browserExtensionSigner();
            if (!signer) throw new Error("Nostr signer is unavailable");
            const pubkey = this._normalizePubkey(await signer.getPublicKey());

            const displayName = this._displayNameFromPubkey(pubkey);
            const event = await this._signIdentityEvent(signer, pubkey, displayName);

            this._identity = {
                pubkey,
                displayName,
                picture: "",
                relays: {read: [], write: []},
                followPubkeys: [],
                followListStatus: "loading",
                blossomServers: [],
                blossomServerListStatus: "loading",
                event,
                verified: !!event
            };
            this._signer = signer;

            localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));
            globalThis.Events.fire("notify-user", globalThis.Localization.getTranslation("notifications.nostr-connected"));
            globalThis.Events.fire("self-display-name-changed", this._identity);
            globalThis.Events.fire("nostr-identity-changed", this._identity);
            this._render();
            this.hydrateIdentity();
        } catch (error) {
            console.error("Nostr identity login failed", error);
            const reason = error?.message || String(error);
            globalThis.Events.fire("notify-user", `${globalThis.Localization.getTranslation("notifications.nostr-connect-failed")}: ${reason}`);
        }
    }

    async _signIdentityEvent(signer, pubkey, displayName) {
        if (!signer?.signEvent) return null;

        try {
            const event = await signer.signEvent({
                kind: 27235,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ["client", "meshdrop"],
                    ["origin", location.origin],
                    ["name", displayName]
                ],
                content: "MeshDrop Nostr identity"
            });

            if (!event || event.pubkey !== pubkey) {
                console.warn("Nostr identity event was ignored because signer returned a mismatched event", event);
                return null;
            }

            return event;
        } catch (error) {
            console.warn("Nostr identity event signing failed; continuing with NIP-07 public key sign-in", error);
            return null;
        }
    }

    disconnect() {
        this._identity = null;
        localStorage.removeItem("meshdrop_nostr_identity");
        globalThis.Events.fire("notify-user", globalThis.Localization.getTranslation("notifications.nostr-disconnected"));
        globalThis.Events.fire("self-display-name-changed", {displayName: "", picture: ""});
        globalThis.Events.fire("nostr-identity-changed", null);
        this._render();
    }

    getIdentity() {
        return this._identity;
    }

    async signEvent(event) {
        const signer = this._signer || this._defaultSigner();
        if (!signer?.signEvent) throw new Error("Nostr signer is unavailable");
        return signer.signEvent(event);
    }

    hasSigner() {
        return !!(window.nostr?.getPublicKey && window.nostr?.signEvent);
    }

    hasAnySigner() {
        return this.hasSigner() || this._hasAndroidSigner();
    }

    canEncrypt() {
        return !!(window.nostr?.nip04?.encrypt && window.nostr?.nip04?.decrypt);
    }

    canNip44() {
        return !!(window.nostr?.nip44?.encrypt && window.nostr?.nip44?.decrypt);
    }

    async encryptTo(pubkey, plaintext) {
        if (!this.canEncrypt()) throw new Error("NIP-04 encryption is unavailable");
        return window.nostr.nip04.encrypt(pubkey, plaintext);
    }

    async decryptFrom(pubkey, ciphertext) {
        if (!this.canEncrypt()) throw new Error("NIP-04 decryption is unavailable");
        return window.nostr.nip04.decrypt(pubkey, ciphertext);
    }

    async encryptNip44To(pubkey, plaintext) {
        if (!this.canNip44()) throw new Error("NIP-44 encryption is unavailable");
        return window.nostr.nip44.encrypt(pubkey, plaintext);
    }

    async decryptNip44From(pubkey, ciphertext) {
        if (!this.canNip44()) throw new Error("NIP-44 decryption is unavailable");
        return window.nostr.nip44.decrypt(pubkey, ciphertext);
    }

    _onServerDisplayName(message) {
        if (!message.nostrIdentity || !this._identity) return;
        if (message.nostrIdentity.pubkey !== this._identity.pubkey) return;

        const serverDisplayName = message.nostrIdentity.displayName || "";
        if (!serverDisplayName) return;

        if (this._isFallbackDisplayName(serverDisplayName, this._identity.pubkey)
            && !this._isFallbackDisplayName(this._identity.displayName, this._identity.pubkey)) {
            return;
        }

        this._identity.displayName = serverDisplayName;
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));
        globalThis.Events.fire("self-display-name-changed", this._identity);
        this._render();
    }

    async hydrateIdentity() {
        if (!this._identity || !globalThis.meshdropNostrRelays) return;

        const pubkey = this._identity.pubkey;
        this._setFollowListStatus("loading", this._identity.followPubkeys || [], false);
        this._setServerListStatus("loading", this._identity.blossomServers || []);
        try {
            const discovery = await globalThis.meshdropNostrRelays.lookupUser(pubkey);
            if (!this._identity || this._identity.pubkey !== pubkey) return;

            if (discovery?.profile?.displayName) this._identity.displayName = discovery.profile.displayName;
            if (discovery?.profile?.picture) this._identity.picture = discovery.profile.picture;
            this._identity.relays = discovery?.relays || {read: [], write: []};
            this._setFollowListStatus(
                discovery?.followList?.status || "missing",
                discovery?.followPubkeys || [],
                false
            );
            this._setServerListStatus(
                discovery?.blossomServerList?.status || "missing",
                discovery?.blossomServers || [],
                false
            );

            localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));
            globalThis.Events.fire("self-display-name-changed", this._identity);
            globalThis.Events.fire("nostr-identity-changed", this._identity);
            this._render();
        } catch (error) {
            this._setFollowListStatus("error", this._identity.followPubkeys || [], false);
            this._setServerListStatus("error", this._identity.blossomServers || []);
            console.warn("Nostr identity profile lookup failed", error);
        }
    }

    async ensureFollowListLoaded() {
        if (!this._identity) return null;
        if (globalThis.NostrFollowPolicy?.followListReady(this._identity)) return this._identity;

        await this.hydrateIdentity();
        return this._identity;
    }

    _render() {
        if (!this.$button) return;

        this.$button.removeAttribute("hidden");

        const translationKey = this._identity
            ? "header.nostr-identity-disconnect"
            : "header.nostr-identity-connect";

        this.$button.title = globalThis.Localization.getTranslation(`${translationKey}_title`);
        this.$button.classList.toggle("selected", !!this._identity);
    }

    async _chooseLoginMethod() {
        const methods = this._loginMethods();
        if (methods.length === 0) return null;
        if (methods.length === 1) return methods[0].id;

        const chooser = globalThis.meshdropNostrLoginDialog;
        if (chooser?.choose) return chooser.choose(methods);

        return methods[0].id;
    }

    _loginMethods() {
        const methods = [];
        if (this.hasSigner()) {
            methods.push({
                id: "browser-extension",
                label: "Browser Extension",
                description: "Use the NIP-07 signer injected into this browser."
            });
        }
        methods.push({
            id: "remote-signer",
            label: "Remote Signer",
            description: "Use a remote signer or Nostr Connect signer."
        });
        if (this._hasAndroidSigner()) {
            methods.push({
                id: "android-signer",
                label: "Open in Amber",
                description: "Open the installed Android Nostr signer."
            });
        }
        return methods;
    }

    _openRemoteSigner() {
        globalThis.Events.fire(
            "notify-user",
            globalThis.Localization.getTranslation("notifications.nostr-remote-signer-unavailable")
        );
    }

    _defaultSigner() {
        return this._browserExtensionSigner() || this._androidSigner();
    }

    _browserExtensionSigner() {
        if (!this.hasSigner()) return null;
        return window.nostr;
    }

    _hasAndroidSigner() {
        return globalThis.AndroidNostrSigner?.isAvailable?.() || false;
    }

    _androidSigner() {
        if (!this._hasAndroidSigner()) return null;

        return new globalThis.AndroidNostrSigner(() => this._identity);
    }

    _displayNameFromPubkey(pubkey) {
        return `npub ${pubkey.slice(0, 8)}`;
    }

    _withServerListState(identity) {
        if (!identity) return null;

        return {
            ...identity,
            followPubkeys: Array.isArray(identity.followPubkeys) ? identity.followPubkeys : [],
            followListStatus: identity.followListStatus || "loading",
            blossomServers: Array.isArray(identity.blossomServers) ? identity.blossomServers : [],
            blossomServerListStatus: identity.blossomServerListStatus || "loading"
        };
    }

    _setFollowListStatus(status, pubkeys = [], notify = true) {
        if (!this._identity) return;

        this._identity.followListStatus = status;
        this._identity.followPubkeys = [...new Set((pubkeys || [])
            .filter(pubkey => globalThis.NostrDiscoveryProtocol.pubkeyRegex.test(pubkey || ""))
            .map(pubkey => pubkey.toLowerCase()))];
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));

        if (notify) {
            globalThis.Events.fire("nostr-follow-list-changed", {
                status: this._identity.followListStatus,
                pubkeys: this._identity.followPubkeys
            });
            globalThis.Events.fire("nostr-identity-changed", this._identity);
        }
    }

    _setServerListStatus(status, servers = [], notify = true) {
        if (!this._identity) return;

        this._identity.blossomServerListStatus = status;
        this._identity.blossomServers = globalThis.ProtocolServerPreferences.normalizeServers(servers);
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));

        if (notify) {
            globalThis.Events.fire("nostr-server-list-changed", {
                status: this._identity.blossomServerListStatus,
                servers: this._identity.blossomServers
            });
            globalThis.Events.fire("nostr-identity-changed", this._identity);
        }
    }

    _isFallbackDisplayName(displayName, pubkey) {
        if (!displayName || !pubkey) return true;

        return displayName === this._displayNameFromPubkey(pubkey)
            || displayName === this._identity?.npub;
    }

    _normalizePubkey(pubkey) {
        return globalThis.NostrPubkey.normalize(pubkey);
    }

    _watchSignerAvailability() {
        let checksRemaining = 40;
        const update = () => {
            const signerAvailable = this.hasAnySigner();
            if (signerAvailable !== this._signerAvailable) {
                this._signerAvailable = signerAvailable;
                if (!signerAvailable && this._identity) this.disconnect();
                this._render();
                globalThis.Events.fire("nostr-signer-available-changed", signerAvailable);
            }

            if (!signerAvailable && checksRemaining-- > 0) {
                const timer = setTimeout(update, 250);
                if (timer.unref) timer.unref();
            }
        };

        const timer = setTimeout(update, 0);
        if (timer.unref) timer.unref();
    }
}

globalThis.NostrIdentityController = NostrIdentityController;
