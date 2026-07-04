const RuntimeCapabilities = {
    staticRtcConfig: {
        sdpSemantics: "unified-plan",
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    },

    staticConfig() {
        return {
            signalingServer: false,
            nostrMesh: {
                relays: ["wss://bucket.coracle.social"]
            },
            blossom: {
                servers: []
            },
            pollen: {
                enabled: false,
                maxUploadBytes: 0,
                room: ""
            },
            fips: {
                enabled: false,
                room: ""
            },
            admin: {
                enabled: false,
                pubkey: "",
                npub: ""
            },
            capabilities: {
                schemaVersion: 1,
                runtime: {
                    target: "spa",
                    platform: "browser",
                    hasBackend: false,
                    sharedInstance: false
                },
                transports: {
                    localDiscovery: {
                        supported: false,
                        requiresBackend: true
                    },
                    webrtc: {
                        supported: true,
                        requiresBackend: false
                    },
                    nostr: {
                        supported: true,
                        requiresBackend: false,
                        requiresNostrIdentity: true
                    },
                    blossom: {
                        supported: true,
                        requiresBackend: false,
                        requiresNostrIdentity: true,
                        configuredServers: 0
                    },
                    hashtree: {
                        supported: true,
                        requiresBackend: false,
                        requiresNostrIdentity: true
                    },
                    pollen: {
                        supported: false,
                        requiresBackend: true,
                        room: "",
                        maxUploadBytes: 0
                    },
                    fips: {
                        supported: false,
                        requiresBackend: true,
                        room: ""
                    }
                },
                serverSettings: {
                    supported: false,
                    requiresAdminSignature: true,
                    actions: {
                        fipsPeers: false
                    }
                }
            },
            wsConfig: {
                rtcConfig: this.staticRtcConfig,
                wsFallback: false
            },
            buttons: {
                donation_button: {},
                twitter_button: {},
                mastodon_button: {},
                bluesky_button: {},
                custom_button: {},
                privacypolicy_button: {}
            }
        };
    },

    hasBackend(config = {}) {
        return config?.capabilities?.runtime?.hasBackend !== false;
    },

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
