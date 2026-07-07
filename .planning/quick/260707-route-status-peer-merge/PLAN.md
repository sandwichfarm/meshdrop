---
status: complete
created: 2026-07-07
slug: route-status-peer-merge
---

# Quick Task: Route Status And Peer Merge

## Goal

Make cross-device Nostr/FIPS/Pollen connection attempts visible and prevent one trusted npub from appearing as separate peers across routes.

## Scope

- Emit route-status events from WebRTC route selection, ICE state, failures, and attempt timeouts.
- Show the active route and phase on pending peer cards.
- Keep per-route target peer IDs so merged identities signal over the correct route-specific ID.
- Trigger fallback on ICE failure or route attempt timeout instead of waiting for the next announcement.
- Add focused tests for route status text, route fallback, and same-identity route merging.
- Load FIPS/Pollen discovery rooms from the logged-in Nostr identity follow graph at runtime.
- Remove static discovery npub environment wiring and keep `npub-network:unconfigured` only for explicit public/debug discovery.
- Reject sessionless WebRTC signaling; no legacy compatibility path.

## Verification Plan

- Focused client protocol tests.
- `npm test`.
- `git diff --check`.
- Changed-code and full-repo AI-slop scans.

## Result

- Nostr follow-list WOT is the default discovery surface.
- FIPS/Pollen join only browser-derived runtime rooms; empty means no discovery room.
- Generic FIPS peers are route candidates, not MeshDrop HTTP peers.
- Route UI reports active route states and falls through Nostr -> FIPS -> Pollen on WebRTC route failure.
- Same Nostr pubkey across Nostr/FIPS/Pollen routes merges into one visible peer while retaining route-specific signal targets.
- Legacy static discovery npub env and sessionless WebRTC answers are removed.

## Evidence

- `node --test test/nostr-discovery-protocol.test.js test/ws-room.test.js test/fips-control.test.js test/federation-server.test.js test/action-visibility.test.js test/pollen-transfer-protocol.test.js test/rtc-peer-signaling.test.js test/peer-availability-protocol.test.js test/start9-package.test.js test/umbrel-package.test.js test/uat-runbooks.test.js` -> 130/130 passing.
- `npm test` -> 280/280 passing.
- `npm run test:e2e` -> passed; proofs included `nostr-webrtc`, `generic-fips-route-candidate`, and `federated-pollen-public-webrtc`.
- `npm run test:docker` -> passed; proofs included `docker-local-webrtc` and two-host `docker-two-host-nostr-webrtc`.
- `git diff --check` -> clean.
- `rg` for removed static discovery env/sessionless legacy tokens -> no source hits.
- `npx --yes aislop scan --changes .` -> zero formatting, AI-slop, security, and lint issues; exits non-zero on pre-existing large-file/duplicate-block warnings in touched legacy files.
- `npx --yes aislop scan .` -> baseline still non-zero on existing large-file/duplicate/linted vendored-code warnings and one pre-existing hardcoded URL warning.
