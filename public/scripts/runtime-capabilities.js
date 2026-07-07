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
            tor: {
                enabled: false
            },
            i2p: {
                enabled: false
            },
            loki: {
                enabled: false
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
                        maxUploadBytes: 0,
                        unavailableReason: this.backendOnlyUnavailableReason(staticTransports.pollen),
                        relayIce: this.relayIceCapability("pollen", staticTransports.pollen, targetManifest)
                    },
                    fips: {
                        supported: staticTransports.fips,
                        requiresBackend: true,
                        room: "",
                        unavailableReason: this.backendOnlyUnavailableReason(staticTransports.fips),
                        stream: {
                            supported: false,
                            primitive: "fips-http-stream",
                            maxUploadBytes: 0
                        },
                        relayIce: this.relayIceCapability("fips", staticTransports.fips, targetManifest)
                    },
                    ...this.overlayNetworkCapabilities(staticTransports)
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

        return {
            localDiscovery: false,
            webrtc: transports.webrtc !== false,
            nostr: transports.nostr !== false,
            blossom: transports.blossom !== false,
            hashtree: transports.hashtree !== false,
            bluetooth: false,
            pollen: transports.pollen === true && this.staticBackendOnlyRouteAvailable("pollen", targetManifest),
            fips: transports.fips === true && this.staticBackendOnlyRouteAvailable("fips", targetManifest),
            tor: false,
            i2p: false,
            loki: false
        };
    },

    overlayNetworkCapabilities(staticTransports = {}) {
        return Object.fromEntries(["tor", "i2p", "loki"].map(routeType => [
            routeType,
            {
                supported: staticTransports[routeType] === true,
                requiresBackend: true,
                transportShape: "stream",
                unavailableReason: this.backendOnlyUnavailableReason(staticTransports[routeType] === true),
                stream: {
                    supported: false,
                    primitive: `${routeType}-http-stream`,
                    endpointConfigured: false,
                    maxUploadBytes: 0
                }
            }
        ]));
    },

    staticBackendOnlyRouteAvailable(routeType, targetManifest = null) {
        if (targetManifest?.target === "android") return this.androidNativeBackendAvailable(targetManifest);

        const transport = targetManifest?.capabilities?.transports?.[routeType] || {};
        return transport.browserRoute === true || transport.objectStore === true || transport.nativeBridgeAvailable === true;
    },

    backendOnlyUnavailableReason(supported) {
        return supported ? "" : "requires-instance-native-route";
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

    relayIceCapability(routeType, transportSupported, targetManifest = null) {
        const relayIce = targetManifest?.capabilities?.transports?.[routeType]?.relayIce || {};
        if (transportSupported && relayIce.supported === true) {
            const relayRtcConfig = this.relayIceRtcConfig(relayIce);
            if (relayRtcConfig) {
                return {
                    supported: true,
                    rtcConfig: relayRtcConfig
                };
            }
        }

        return {
            supported: false,
            unavailableReason: `${routeType}-relay-ice-not-configured`
        };
    },

    relayIceRtcConfig(relayIce = {}) {
        const rtcConfig = relayIce.rtcConfig || {};
        if (!Array.isArray(rtcConfig.iceServers)) return null;

        const iceServers = rtcConfig.iceServers
            .map(server => this.relayIceServer(server))
            .filter(Boolean);
        if (iceServers.length === 0) return null;

        return {
            ...rtcConfig,
            iceServers,
            iceTransportPolicy: "relay"
        };
    },

    relayIceServer(server = {}) {
        const urls = this.relayIceUrls(server.urls);
        if (!urls) return null;

        const normalized = {urls};
        for (const key of ["username", "credential", "credentialType"]) {
            if (server[key]) normalized[key] = server[key];
        }
        return normalized;
    },

    relayIceUrls(urls) {
        const list = Array.isArray(urls) ? urls : [urls];
        const relayUrls = list
            .map(url => String(url || "").trim())
            .filter(url => /^turns?:/i.test(url));
        if (relayUrls.length === 0) return null;
        return Array.isArray(urls) ? relayUrls : relayUrls[0];
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

    relayIceSupported(config, transport) {
        const relayIce = this.transports(config)[transport]?.relayIce;
        return relayIce?.supported === true && !!this.relayIceRtcConfig(relayIce);
    },

    relayIceConfig(config, transport) {
        return this.relayIceRtcConfig(this.transports(config)[transport]?.relayIce);
    },

    serverActionSupported(config, action) {
        const serverSettings = config?.capabilities?.serverSettings;
        if (!serverSettings) return true;
        if (!serverSettings.supported) return false;

        return !!serverSettings.actions?.[action];
    }
};

globalThis.RuntimeCapabilities = RuntimeCapabilities;
