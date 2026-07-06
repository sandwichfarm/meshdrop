import crypto from "crypto";
import fs from "fs";
import path from "path";
import {generateSecretKey, utils} from "nostr-tools";
import {
    createNpubDiscoveryNetwork,
    parseNostrPubkeys,
    pubkeyFromSecret
} from "./npub-network.js";

const SERVICE_PREFIX = "meshdrop-fed";

export function createFederationConfig(env = process.env) {
    const enabled = env.MESHDROP_FEDERATION !== "false";
    const serverId = env.MESHDROP_SERVER_ID || loadOrCreateServerId(env.PLN_DIR || "/var/lib/meshdrop/pln");
    const secretKey = loadOrCreateNostrKey(env.MESHDROP_NOSTR_SECRET_KEY, env.PLN_DIR || "/var/lib/meshdrop/pln");
    const network = createNpubDiscoveryNetwork({
        localPubkey: pubkeyFromSecret(secretKey),
        peerPubkeys: parseNostrPubkeys(env.MESHDROP_DISCOVERY_NPUBS || env.MESHDROP_NPUBS || "")
    });

    return {
        enabled,
        serverId,
        port: Number.parseInt(env.PORT || "3000", 10) || 3000,
        basePath: env.MESHDROP_FEDERATION_BASE_PATH || "",
        pollMs: Number.parseInt(env.MESHDROP_FEDERATION_POLL_MS || "", 10) || 15000,
        fips: {
            enabled: enabled && env.FIPS_DISCOVERY !== "false",
            room: network.id,
            port: Number.parseInt(env.FIPS_FEDERATION_PORT || env.PORT || "3000", 10) || 3000,
            publicUrl: env.FIPS_FEDERATION_URL || env.MESHDROP_FEDERATION_PUBLIC_URL || ""
        },
        pollen: {
            enabled: enabled && env.POLLEN_TRANSFER !== "false",
            room: network.id,
            command: env.PLN_BIN || "pln",
            dir: env.PLN_DIR || "/var/lib/meshdrop/pln",
            serviceName: env.POLLEN_FEDERATION_SERVICE || `${SERVICE_PREFIX}-${serverId.slice(0, 16)}`
        },
        nostr: {
            enabled: env.POLLEN_NOSTR_BOOTSTRAP !== "false",
            relays: (env.NOSTR_RELAYS || "wss://bucket.coracle.social")
                .split(",")
                .map(relay => relay.trim())
                .filter(Boolean),
            pubkey: network.localPubkey,
            recipientPubkeys: network.recipientPubkeys,
            networkId: network.id,
            secretKey
        },
        trace: env.MESHDROP_FEDERATION_TRACE !== "false",
        timeoutMs: Number.parseInt(env.MESHDROP_FEDERATION_TIMEOUT_MS || "", 10) || 2500
    };
}

function loadOrCreateServerId(dir) {
    return loadOrCreateFile(path.join(dir, "meshdrop-server-id"), () => crypto.randomUUID());
}

function loadOrCreateNostrKey(envKey, dir) {
    if (envKey) {
        return utils.hexToBytes(envKey);
    }

    const hex = loadOrCreateFile(path.join(dir, "meshdrop-nostr-secret"), () => utils.bytesToHex(generateSecretKey()));
    return utils.hexToBytes(hex);
}

function loadOrCreateFile(filePath, createValue) {
    try {
        return fs.readFileSync(filePath, "utf8").trim();
    } catch {
        const value = createValue();
        try {
            fs.mkdirSync(path.dirname(filePath), {recursive: true, mode: 0o700});
            fs.writeFileSync(filePath, `${value}\n`, {mode: 0o600});
        } catch {
            return value;
        }
        return value;
    }
}
