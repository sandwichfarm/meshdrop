const AdminSettingsProtocol = {
    pubkeyRegex: /^[0-9a-f]{64}$/i,
    config: {},

    normalizePubkey(pubkey) {
        return this.pubkeyRegex.test(pubkey || "") ? pubkey.toLowerCase() : "";
    },

    canManageServerSettings(config, identity) {
        const adminPubkey = this.normalizePubkey(config?.admin?.pubkey || "");
        const identityPubkey = this.normalizePubkey(identity?.pubkey || "");

        return !!config?.admin?.enabled && !!adminPubkey && adminPubkey === identityPubkey;
    },

    setConfig(config) {
        this.config = config || {};
        this.renderServerSettings();
    },

    getIdentity() {
        return globalThis.meshdropNostrIdentity?.getIdentity?.() || null;
    },

    canManageCurrentServerSettings() {
        return this.canManageServerSettings(this.config, this.getIdentity());
    },

    async signServerRequest(action, payload = {}) {
        if (!this.canManageCurrentServerSettings()) throw new Error("configured admin npub is not connected");

        const request = {action, ...payload};
        const event = await globalThis.meshdropNostrIdentity.signEvent({
            kind: Math.floor(Math.random() * 10000),
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["client", "meshdrop"],
                ["admin", action],
                ["origin", globalThis.location?.origin || ""]
            ],
            content: JSON.stringify(request)
        });

        return {event};
    },

    renderServerSettings() {
        const canManage = this.canManageCurrentServerSettings();
        const fipsTab = globalThis.document?.querySelector?.('[data-settings-tab="fips"]');
        const fipsPanel = globalThis.document?.querySelector?.('[data-settings-panel="fips"]');
        const blossomTab = globalThis.document?.querySelector?.('[data-settings-tab="blossom"]');

        fipsTab?.toggleAttribute("hidden", !canManage);
        if (!canManage && fipsTab?.classList?.contains("selected")) blossomTab?.click?.();
        fipsPanel?.toggleAttribute("hidden", !canManage || !fipsTab?.classList?.contains("selected"));
    }
};

globalThis.AdminSettingsProtocol = AdminSettingsProtocol;

const originalFetch = globalThis.fetch?.bind(globalThis);
if (originalFetch) {
    globalThis.fetch = async (input, init = {}) => {
        const path = requestPath(input);
        if (path.endsWith("/settings/fips/peers") || path === "settings/fips/peers") {
            init = await signedFipsSettingsInit(init);
        }

        return originalFetch(input, init);
    };
}

bindAdminSettingsEvents();

function requestPath(input) {
    return typeof input === "string" ? input : input?.url || "";
}

async function signedFipsSettingsInit(init) {
    const body = parseJson(init.body);
    if (!Array.isArray(body?.peers) || body.event) return init;

    return {
        ...init,
        body: JSON.stringify(await AdminSettingsProtocol.signServerRequest("settings.fips.peers", {peers: body.peers}))
    };
}

function parseJson(value) {
    if (typeof value !== "string") return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function bindAdminSettingsEvents() {
    if (!globalThis.Events) {
        const timer = setTimeout(bindAdminSettingsEvents, 0);
        if (timer.unref) timer.unref();
        return;
    }

    globalThis.Events.on("config", event => AdminSettingsProtocol.setConfig(event.detail || {}));
    globalThis.Events.on("nostr-identity-changed", () => AdminSettingsProtocol.renderServerSettings());
}
