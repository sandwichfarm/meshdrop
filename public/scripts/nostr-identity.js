class NostrIdentityController {

    static pubkeyRegex = /^[0-9a-f]{64}$/i;
    static bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

    constructor() {
        this.$button = $("nostr-identity");
        this._identity = this._withServerListState(this.getStoredIdentity());
        this._signerAvailable = this.hasSigner();
        if (this._identity && !this._signerAvailable) {
            this._identity = null;
            localStorage.removeItem("meshdrop_nostr_identity");
        }

        if (this.$button) {
            this.$button.addEventListener("click", _ => this.toggle());
            this._render();
        }

        this._watchSignerAvailability();
        Events.on("display-name", e => this._onServerDisplayName(e.detail));
        globalThis.meshdropNostrIdentity = this;
        Events.fire("nostr-signer-available-changed", this._signerAvailable);
        if (this._identity) {
            this._setServerListStatus("loading", this._identity.blossomServers || [], false);
            Events.fire("self-display-name-changed", this._identity);
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
        if (!this.hasSigner()) {
            Events.fire("notify-user", Localization.getTranslation("notifications.nostr-extension-required"));
            return;
        }

        try {
            const pubkey = this._normalizePubkey(await window.nostr.getPublicKey());

            const displayName = this._displayNameFromPubkey(pubkey);
            const event = await this._signIdentityEvent(pubkey, displayName);

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

            localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));
            Events.fire("notify-user", Localization.getTranslation("notifications.nostr-connected"));
            Events.fire("self-display-name-changed", this._identity);
            Events.fire("nostr-identity-changed", this._identity);
            this._render();
            this.hydrateIdentity();
        } catch (error) {
            console.error("Nostr identity login failed", error);
            const reason = error?.message || String(error);
            Events.fire("notify-user", `${Localization.getTranslation("notifications.nostr-connect-failed")}: ${reason}`);
        }
    }

    async _signIdentityEvent(pubkey, displayName) {
        try {
            const event = await window.nostr.signEvent({
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
        Events.fire("notify-user", Localization.getTranslation("notifications.nostr-disconnected"));
        Events.fire("self-display-name-changed", {displayName: "", picture: ""});
        Events.fire("nostr-identity-changed", null);
        this._render();
    }

    getIdentity() {
        return this._identity;
    }

    async signEvent(event) {
        if (!this.hasSigner()) throw new Error("NIP-07 signer is unavailable");
        return window.nostr.signEvent(event);
    }

    hasSigner() {
        return !!(window.nostr?.getPublicKey && window.nostr?.signEvent);
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
        Events.fire("self-display-name-changed", this._identity);
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
            Events.fire("self-display-name-changed", this._identity);
            Events.fire("nostr-identity-changed", this._identity);
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

        this.$button.toggleAttribute("hidden", !this._signerAvailable);

        const translationKey = this._identity
            ? "header.nostr-identity-disconnect"
            : "header.nostr-identity-connect";

        this.$button.title = Localization.getTranslation(`${translationKey}_title`);
        this.$button.classList.toggle("selected", !!this._identity);
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
            .filter(pubkey => NostrDiscoveryProtocol.pubkeyRegex.test(pubkey || ""))
            .map(pubkey => pubkey.toLowerCase()))];
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));

        if (notify) {
            Events.fire("nostr-follow-list-changed", {
                status: this._identity.followListStatus,
                pubkeys: this._identity.followPubkeys
            });
            Events.fire("nostr-identity-changed", this._identity);
        }
    }

    _setServerListStatus(status, servers = [], notify = true) {
        if (!this._identity) return;

        this._identity.blossomServerListStatus = status;
        this._identity.blossomServers = ProtocolServerPreferences.normalizeServers(servers);
        localStorage.setItem("meshdrop_nostr_identity", JSON.stringify(this._identity));

        if (notify) {
            Events.fire("nostr-server-list-changed", {
                status: this._identity.blossomServerListStatus,
                servers: this._identity.blossomServers
            });
            Events.fire("nostr-identity-changed", this._identity);
        }
    }

    _isFallbackDisplayName(displayName, pubkey) {
        if (!displayName || !pubkey) return true;

        return displayName === this._displayNameFromPubkey(pubkey)
            || displayName === this._identity?.npub;
    }

    _normalizePubkey(pubkey) {
        if (typeof pubkey !== "string") throw new Error("NIP-07 signer returned a non-string public key");

        const trimmed = pubkey.trim();
        if (NostrIdentityController.pubkeyRegex.test(trimmed)) return trimmed.toLowerCase();
        if (trimmed.toLowerCase().startsWith("npub1")) return this._npubToHex(trimmed);

        throw new Error("NIP-07 signer returned an invalid public key");
    }

    _npubToHex(npub) {
        const decoded = this._bech32Decode(npub);
        if (decoded.hrp !== "npub") throw new Error("NIP-07 signer returned an invalid npub public key");

        const bytes = this._convertBits(decoded.words, 5, 8, false);
        if (bytes.length !== 32) throw new Error("NIP-07 signer returned an invalid npub public key");

        return bytes.map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    _bech32Decode(value) {
        const bech32 = value.toLowerCase();
        const separator = bech32.lastIndexOf("1");
        if (separator < 1) throw new Error("NIP-07 signer returned an invalid npub public key");

        const hrp = bech32.slice(0, separator);
        const data = bech32.slice(separator + 1);
        const values = [...data].map(char => NostrIdentityController.bech32Charset.indexOf(char));
        if (values.includes(-1) || values.length < 6) {
            throw new Error("NIP-07 signer returned an invalid npub public key");
        }

        if (!this._bech32VerifyChecksum(hrp, values)) {
            throw new Error("NIP-07 signer returned an invalid npub checksum");
        }

        return {hrp, words: values.slice(0, -6)};
    }

    _bech32VerifyChecksum(hrp, values) {
        return this._bech32Polymod([...this._bech32HrpExpand(hrp), ...values]) === 1;
    }

    _bech32HrpExpand(hrp) {
        const highBits = [...hrp].map(char => char.charCodeAt(0) >> 5);
        const lowBits = [...hrp].map(char => char.charCodeAt(0) & 31);
        return [...highBits, 0, ...lowBits];
    }

    _bech32Polymod(values) {
        const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        let chk = 1;

        for (const value of values) {
            const top = chk >> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ value;
            for (let i = 0; i < generators.length; i++) {
                if ((top >> i) & 1) chk ^= generators[i];
            }
        }

        return chk;
    }

    _convertBits(data, fromBits, toBits, pad) {
        let accumulator = 0;
        let bits = 0;
        const result = [];
        const maxValue = (1 << toBits) - 1;
        const maxAccumulator = (1 << (fromBits + toBits - 1)) - 1;

        for (const value of data) {
            if (value < 0 || (value >> fromBits) !== 0) throw new Error("NIP-07 signer returned an invalid npub public key");
            accumulator = ((accumulator << fromBits) | value) & maxAccumulator;
            bits += fromBits;
            while (bits >= toBits) {
                bits -= toBits;
                result.push((accumulator >> bits) & maxValue);
            }
        }

        if (pad) {
            if (bits > 0) result.push((accumulator << (toBits - bits)) & maxValue);
        } else if (bits >= fromBits || ((accumulator << (toBits - bits)) & maxValue)) {
            throw new Error("NIP-07 signer returned an invalid npub public key");
        }

        return result;
    }

    _watchSignerAvailability() {
        let checksRemaining = 40;
        const update = () => {
            const signerAvailable = this.hasSigner();
            if (signerAvailable !== this._signerAvailable) {
                this._signerAvailable = signerAvailable;
                if (!signerAvailable && this._identity) this.disconnect();
                this._render();
                Events.fire("nostr-signer-available-changed", signerAvailable);
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
