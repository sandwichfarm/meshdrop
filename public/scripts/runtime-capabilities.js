const RuntimeCapabilities = {
    transports(config = {}) {
        return config.capabilities?.transports || {};
    },

    transportSupported(config, transport, fallback = false) {
        const capability = this.transports(config)[transport];
        if (typeof capability?.supported === "boolean") return capability.supported;

        return !!fallback;
    },

    serverActionSupported(config, action) {
        const serverSettings = config?.capabilities?.serverSettings;
        if (!serverSettings) return true;
        if (!serverSettings.supported) return false;

        return !!serverSettings.actions?.[action];
    }
};

globalThis.RuntimeCapabilities = RuntimeCapabilities;
