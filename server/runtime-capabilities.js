const DEFAULT_RUNTIME_TARGET = "standalone";

export function createRuntimeCapabilities(conf = {}) {
    const runtime = conf.runtime || {};
    const hasBackend = runtime.hasBackend !== false;
    const fipsSupported = hasBackend && !!conf.fips?.enabled;
    const pollenSupported = hasBackend && !!conf.pollen?.enabled;
    const adminEnabled = hasBackend && !!conf.admin?.enabled;

    return {
        schemaVersion: 1,
        runtime: {
            target: runtime.target || DEFAULT_RUNTIME_TARGET,
            platform: runtime.platform || "server",
            hasBackend,
            sharedInstance: hasBackend && adminEnabled
        },
        transports: {
            localDiscovery: {
                supported: hasBackend && !conf.signalingServer,
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
                configuredServers: conf.blossom?.servers?.length || 0
            },
            hashtree: {
                supported: true,
                requiresBackend: false,
                requiresNostrIdentity: true
            },
            pollen: {
                supported: pollenSupported,
                requiresBackend: true,
                room: conf.federation?.pollen?.room || "",
                maxUploadBytes: conf.pollen?.maxUploadBytes || 0
            },
            fips: {
                supported: fipsSupported,
                requiresBackend: true,
                room: conf.fips?.room || ""
            }
        },
        serverSettings: {
            supported: hasBackend && adminEnabled,
            requiresAdminSignature: true,
            actions: {
                fipsPeers: hasBackend && adminEnabled && fipsSupported
            }
        }
    };
}
