import {getEventHash, nip19, validateEvent, verifyEvent} from "nostr-tools";

import {parseNostrPubkey} from "./npub-network.js";

const MAX_ADMIN_EVENT_BYTES = 64 * 1024;
const MAX_ADMIN_CLOCK_SKEW_SECONDS = 10 * 60;
const MIN_ADMIN_KIND = 0;
const MAX_ADMIN_KIND = 9999;

export function createAdminConfig(env = process.env) {
    const pubkey = parseNostrPubkey(env.MESHDROP_ADMIN_NPUB || env.MESHDROP_ADMIN_PUBKEY || "");

    return {
        enabled: !!pubkey,
        pubkey,
        npub: pubkey ? nip19.npubEncode(pubkey) : ""
    };
}

export function adminPublicConfig(admin = {}) {
    return {
        enabled: !!admin.enabled,
        pubkey: admin.pubkey || "",
        npub: admin.npub || ""
    };
}

export function verifySignedAdminRequest(admin, event, options = {}) {
    if (!admin?.enabled || !admin.pubkey) return reject("admin_not_configured");
    if (!event || typeof event !== "object") return reject("admin_event_missing");

    const eventSize = Buffer.byteLength(JSON.stringify(event), "utf8");
    if (eventSize > MAX_ADMIN_EVENT_BYTES) return reject("admin_event_too_large");
    if (!validateEvent(event) || getEventHash(event) !== event.id || !verifyEvent(event)) {
        return reject("admin_event_invalid");
    }
    if (event.pubkey !== admin.pubkey) return reject("admin_pubkey_mismatch");
    if (!Number.isInteger(event.kind) || event.kind < MIN_ADMIN_KIND || event.kind > MAX_ADMIN_KIND) {
        return reject("admin_kind_out_of_range");
    }

    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - event.created_at) > MAX_ADMIN_CLOCK_SKEW_SECONDS) {
        return reject("admin_event_stale");
    }

    let request;
    try {
        request = JSON.parse(event.content);
    } catch {
        return reject("admin_request_invalid");
    }

    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return reject("admin_request_invalid");
    }

    return {ok: true, request, event};
}

function reject(error) {
    return {ok: false, error};
}
