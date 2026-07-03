import {nip19, validateEvent, verifyEvent} from "nostr-tools";

export const MESH_DROP_NOSTR_AUTH_KIND = 27235;
export const MESH_DROP_NOSTR_AUTH_CONTENT = "MeshDrop Nostr identity";

const MAX_IDENTITY_LENGTH = 4096;
const MAX_CLOCK_SKEW_SECONDS = 10 * 60;
const PUBKEY_REGEX = /^[0-9a-f]{64}$/;

export function getNostrIdentityFromRequest(request) {
    const searchParams = new URL(request.url, "http://server").searchParams;
    const rawIdentity = searchParams.get("nostr_identity");

    return verifyNostrIdentity(rawIdentity, {
        origin: request.headers.origin,
        now: Math.floor(Date.now() / 1000)
    });
}

export function verifyNostrIdentity(rawIdentity, options = {}) {
    if (!rawIdentity || rawIdentity.length > MAX_IDENTITY_LENGTH) return null;

    let identity;
    try {
        identity = JSON.parse(rawIdentity);
    } catch {
        return null;
    }

    const event = identity?.event;
    if (!event || !validateEvent(event) || !verifyEvent(event)) return null;
    if (event.kind !== MESH_DROP_NOSTR_AUTH_KIND) return null;
    if (event.content !== MESH_DROP_NOSTR_AUTH_CONTENT) return null;
    if (!PUBKEY_REGEX.test(event.pubkey)) return null;
    if (identity.pubkey && identity.pubkey !== event.pubkey) return null;

    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - event.created_at) > MAX_CLOCK_SKEW_SECONDS) return null;

    const origin = getTagValue(event, "origin");
    if (options.origin && origin !== options.origin) return null;

    const displayName = sanitizeDisplayName(getTagValue(event, "name"))
        || nip19.npubEncode(event.pubkey);

    return {
        type: "nostr",
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        displayName,
        verified: true,
        createdAt: event.created_at,
        origin: origin || null
    };
}

function getTagValue(event, name) {
    const tag = event.tags.find(tag => tag[0] === name && tag[1]);
    return tag ? tag[1] : "";
}

function sanitizeDisplayName(displayName) {
    if (typeof displayName !== "string") return "";

    return displayName
        .replace(/[\x00-\x1F\x7F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 64);
}
