---
quick_id: 260707-hq6
slug: add-configurable-overlay-relay-ice-plumb
date: 2026-07-07
status: complete
---

# Summary

Added configurable relay ICE plumbing for FIPS and Pollen overlay routes. Runtime capabilities now advertise overlay relay ICE only when TURN/TURNS RTC config exists, and browser route selection uses route-specific relay-only RTC config instead of global STUN/default ICE servers.

This is still not proof that a relay is FIPS-backed or Pollen-backed. It is the configuration and fail-closed plumbing required before a deployed relay can be validated with WebRTC stats.

## Changed

- Added `server/relay-ice-config.js` for parsing `FIPS_RELAY_ICE_*` and `POLLEN_RELAY_ICE_*` env/file config.
- Wired parsed relay config into server runtime capabilities.
- Hardened client relay support checks so bare `supported: true` is not enough.
- Updated route selection to use `relayIce.rtcConfig` for forced overlay WebRTC routes.
- Documented relay ICE env/config shape in `docs/webrtc-overlay-transport-requirements.md`.

## Verification

- Red proof: focused tests failed on missing parser module, bare `supported: true` overclaim, and route selection using global STUN instead of route TURN.
- `node --test test/relay-ice-config.test.js test/runtime-capabilities.test.js test/rtc-peer-signaling.test.js` -> 45/45 pass.
- `node --test test/action-visibility.test.js test/relay-ice-config.test.js test/runtime-capabilities.test.js test/rtc-peer-signaling.test.js` -> 82/82 pass.
- `npm test` -> 306/306 pass.
- `npm run test:e2e` -> pass; local WebRTC, Nostr WebRTC, generic FIPS route-candidate-only, and federated Pollen-signaled WebRTC proof passed.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> exit 0; changed-code AI Slop/security/lint clean. Existing `network.js` size/duplicate-block code-quality warnings remain.
- `npx --yes aislop scan .` -> exit 1 on existing baseline warnings in vendored noble files, oversized files, `server/nostr-identity.js` hardcoded URL, TODO/empty-function info.

## Known Gap

Real FIPS/Pollen-backed relay deployment and browser stats proof remain open. The new config hook must be paired with an actual TURN/TURNS service constrained to the target topology before the product can claim WebRTC bytes over FIPS or Pollen.
