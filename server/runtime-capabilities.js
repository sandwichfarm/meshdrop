import {normalizeNpubDiscoveryNetworkId} from "./npub-network.js";
import {createOverlayNetworkCapabilities, createOverlayNetworkConfig} from "./overlay-network-adapters.js";
import {normalizeRelayIceConfig} from "./relay-ice-config.js";

const DEFAULT_RUNTIME_TARGET = "standalone";

export function createServerRuntimeConfig(env = process.env) {
    return {
        target: env.MESHDROP_TARGET || DEFAULT_RUNTIME_TARGET,
        platform: "server",
        hasBackend: true
    };
}

function createBluetoothCapabilities(conf = {}) {
    return {
        supported: false,
        transferSupported: false,
        requiresBackend: false,
        requiresNativeShell: false,
        apiAvailable: conf.apiAvailable === true,
        nativeBridgeAvailable: conf.nativeBridgeAvailable === true,
        requiresAdapter: true,
        unavailableReason: "bluetooth-transfer-not-implemented"
    };
}

function createRelayIceCapability(routeType, transportSupported, conf = {}) {
    if (!transportSupported) return normalizeRelayIceConfig(routeType);
    return normalizeRelayIceConfig(routeType, conf.relayIce);
}

function createIceBridgeCapability(relayIce = {}) {
    return relayIce.supported === true ? {kind: "ice-bridge", ...relayIce} : relayIce;
}

export function createRuntimeCapabilities(conf = {}) {
    const runtime = conf.runtime || createServerRuntimeConfig();
    const hasBackend = runtime.hasBackend !== false;
    const fipsSupported = hasBackend && !!conf.fips?.enabled;
    const pollenSupported = hasBackend && !!conf.pollen?.enabled;
    const adminEnabled = hasBackend && !!conf.admin?.enabled;
    const pollenRelayIce = createRelayIceCapability("pollen", pollenSupported, conf.pollen);
    const fipsRelayIce = createRelayIceCapability("fips", fipsSupported, conf.fips);
    const overlayNetworkCapabilities = createOverlayNetworkCapabilities(
        hasBackend ? (conf.overlayNetworks || createOverlayNetworkConfig({})) : createOverlayNetworkConfig({}),
        {hasBackend}
    );

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
            bluetooth: createBluetoothCapabilities(conf.bluetooth),
            pollen: {
                supported: pollenSupported,
                requiresBackend: true,
                room: normalizeNpubDiscoveryNetworkId(conf.federation?.pollen?.room),
                maxUploadBytes: conf.pollen?.maxUploadBytes || 0,
                iceBridge: createIceBridgeCapability(pollenRelayIce),
                relayIce: pollenRelayIce
            },
            fips: {
                supported: fipsSupported,
                requiresBackend: true,
                room: normalizeNpubDiscoveryNetworkId(conf.fips?.room),
                stream: {
                    supported: fipsSupported && conf.fipsStream?.enabled !== false,
                    primitive: "fips-http-stream",
                    maxUploadBytes: conf.fipsStream?.maxUploadBytes || 0
                },
                iceBridge: createIceBridgeCapability(fipsRelayIce),
                relayIce: fipsRelayIce
            },
            ...overlayNetworkCapabilities
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
