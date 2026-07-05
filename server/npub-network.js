import crypto from "crypto";
import {getPublicKey, nip19, utils} from "nostr-tools";

export const DEFAULT_NPUB_DISCOVERY_NETWORK_ID = "npub-network:unconfigured";

export function isNpubDiscoveryNetworkId(value) {
    return /^npub-network:[a-z0-9:-]+$/i.test(String(value || ""));
}

export function normalizeNpubDiscoveryNetworkId(value) {
    return isNpubDiscoveryNetworkId(value) ? String(value) : DEFAULT_NPUB_DISCOVERY_NETWORK_ID;
}

export function parseNostrPubkey(value) {
    const trimmed = String(value || "").trim();
    if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
    if (!trimmed.startsWith("npub1")) return "";

    try {
        const decoded = nip19.decode(trimmed);
        return decoded.type === "npub" && /^[0-9a-f]{64}$/i.test(decoded.data)
            ? decoded.data.toLowerCase()
            : "";
    }
    catch {
        return "";
    }
}

export function parseNostrPubkeys(raw) {
    return [...new Set(String(raw || "")
        .split(/[,\s]+/)
        .map(parseNostrPubkey)
        .filter(Boolean))];
}

export function pubkeyFromSecret(secretKey) {
    if (!secretKey) return "";
    try {
        const bytes = typeof secretKey === "string" ? utils.hexToBytes(secretKey) : secretKey;
        return getPublicKey(bytes);
    }
    catch {
        return "";
    }
}

export function createNpubDiscoveryNetwork({localPubkey = "", peerPubkeys = []} = {}) {
    const normalizedLocal = parseNostrPubkey(localPubkey);
    const peers = [...new Set(peerPubkeys.map(parseNostrPubkey).filter(Boolean))];
    const recipientPubkeys = peers.filter(pubkey => pubkey !== normalizedLocal);
    const memberPubkeys = [...new Set([normalizedLocal, ...peers].filter(Boolean))].sort();
    const digest = memberPubkeys.length
        ? crypto.createHash("sha256").update(memberPubkeys.join("\n")).digest("hex").slice(0, 32)
        : "";

    return {
        id: digest ? `npub-network:${digest}` : DEFAULT_NPUB_DISCOVERY_NETWORK_ID,
        localPubkey: normalizedLocal,
        recipientPubkeys,
        memberPubkeys
    };
}
