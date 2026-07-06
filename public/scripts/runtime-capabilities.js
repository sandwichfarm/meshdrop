const RuntimeCapabilities = {
    staticRtcConfig: {
        sdpSemantics: "unified-plan",
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    },

    staticConfig(targetManifest = null) {
        const staticRuntime = this.staticRuntime(targetManifest);
        const staticTransports = this.staticTransports(targetManifest);

        return {
            signalingServer: false,
            nostrMesh: {
                relays: ["wss://bucket.coracle.social"]
            },
            blossom: {
                servers: []
            },
            pollen: {
                enabled: staticTransports.pollen,
                maxUploadBytes: 0,
                room: ""
            },
            fips: {
                enabled: staticTransports.fips,
                room: ""
            },
            admin: {
                enabled: false,
                pubkey: "",
                npub: ""
            },
            capabilities: {
                schemaVersion: 1,
                runtime: staticRuntime,
                transports: {
                    localDiscovery: {
                        supported: staticTransports.localDiscovery,
                        requiresBackend: true
                    },
                    webrtc: {
                        supported: staticTransports.webrtc,
                        requiresBackend: false
                    },
                    nostr: {
                        supported: staticTransports.nostr,
                        requiresBackend: false,
                        requiresNostrIdentity: true
                    },
                    blossom: {
                        supported: staticTransports.blossom,
                        requiresBackend: false,
                        requiresNostrIdentity: true,
                        configuredServers: 0
                    },
                    hashtree: {
                        supported: staticTransports.hashtree,
                        requiresBackend: false,
                        requiresNostrIdentity: true
                    },
                    bluetooth: this.bluetoothCapabilities(targetManifest),
                    pollen: {
                        supported: staticTransports.pollen,
                        requiresBackend: true,
                        room: "",
                        maxUploadBytes: 0
                    },
                    fips: {
                        supported: staticTransports.fips,
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

    staticRuntime(targetManifest = null) {
        const runtime = targetManifest?.runtime || {};

        return {
            target: runtime.target || targetManifest?.target || "spa",
            platform: runtime.platform || "browser",
            hasBackend: false,
            sharedInstance: false
        };
    },

    staticTransports(targetManifest = null) {
        const transports = targetManifest?.transports || {};
        const androidNativeBackend = this.androidNativeBackendAvailable(targetManifest);
        const androidBackendReady = targetManifest?.target !== "android" || androidNativeBackend;

        return {
            localDiscovery: transports.localDiscovery === true,
            webrtc: transports.webrtc !== false,
            nostr: transports.nostr !== false,
            blossom: transports.blossom !== false,
            hashtree: transports.hashtree !== false,
            bluetooth: false,
            pollen: transports.pollen === true && androidBackendReady,
            fips: transports.fips === true && androidBackendReady
        };
    },

    androidNativeBackendAvailable(targetManifest = null) {
        if (targetManifest?.target !== "android") return false;

        const backend = globalThis.__meshdropAndroidNativeBackend;
        return backend?.alive === true && typeof backend.baseUrl === "string" && backend.baseUrl.length > 0;
    },

    bluetoothCapabilities(targetManifest = null) {
        const bluetooth =
            targetManifest?.capabilities?.transports?.bluetooth ||
            targetManifest?.bluetooth ||
            {};

        return {
            supported: false,
            transferSupported: false,
            requiresBackend: false,
            requiresNativeShell: false,
            apiAvailable: bluetooth.apiAvailable === true || this.bluetoothApiAvailable(),
            nativeBridgeAvailable: bluetooth.nativeBridgeAvailable === true,
            requiresAdapter: true,
            unavailableReason: "bluetooth-transfer-not-implemented"
        };
    },

    bluetoothApiAvailable() {
        return !!globalThis.navigator?.bluetooth;
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
