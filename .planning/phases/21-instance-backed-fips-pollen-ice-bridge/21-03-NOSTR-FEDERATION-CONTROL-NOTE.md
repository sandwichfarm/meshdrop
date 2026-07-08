# Phase 21 Note: Nostr Federation Control Plane

Status: post-completion runtime follow-up.

## Runtime Evidence

- Live Docker logs showed dynamic WOT rooms active and trusted remote `fips-federation` events accepted.
- FIPS did not connect because federation still attempted overlay HTTP first: `peerCount=0` and remote `/.well-known/meshdrop-federation` fetch failed.
- Pollen did not connect because the remote service was rejected before any usable bridge path: local and remote `pln-root` values differed.

## Delivered

- Added encrypted Nostr federation payloads for scoped FIPS/Pollen room snapshots and relay events.
- Server-side federation can now accept peer snapshots and send SDP/ICE relay events over trusted Nostr when overlay HTTP is unreachable.
- Dynamic browser-selected WOT rooms remain the source of the FIPS/Pollen federation scope; static public env discovery is no longer required for this path.

## Evidence

- Focused: `node --test test/federation-server.test.js` -> 37/37 pass.
- Broad: `npm test` -> 389/389 pass.
- Hygiene: `git diff --check` -> clean.
- Changed-code scan: `npx --yes aislop scan --changes .` -> 0 AI-slop/security/lint/formatting issues; remaining warnings are non-fixable file-size policy warnings in existing large federation files.

## Remaining Risk

- End-to-end two-instance runtime proof requires both MeshDrop instances to run this Nostr federation control-plane code. A one-sided deploy can reply to old announcements, but an old remote instance will not decrypt or use the new payloads.
