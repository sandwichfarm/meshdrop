---
quick_id: 260707-h8o
slug: add-fail-closed-overlay-relay-capability
date: 2026-07-07
status: complete
---

# Summary

Added an explicit relay ICE capability for FIPS and Pollen routes, defaulting to unsupported, and made forced overlay WebRTC selection fail closed when Clearnet file routes are disabled but no overlay relay ICE is configured.

This does not implement a FIPS/Pollen TURN or relay candidate path. It prevents the UI/runtime from treating FIPS/Pollen signaling descriptors as proof that the browser data path is private.

## Changed

- `server/runtime-capabilities.js` and `public/scripts/runtime-capabilities.js` now expose `transports.fips.relayIce` and `transports.pollen.relayIce`.
- `public/scripts/network.js` blocks forced FIPS/Pollen WebRTC route selection with `overlay-relay-unavailable` unless relay ICE is advertised, and uses `iceTransportPolicy: "relay"` when relay ICE is available.
- `public/scripts/fips-discovery.js` and `public/scripts/pollen-transfer.js` label enabled-but-no-relay-ICE controls as signaling-only.
- Regression tests cover default unavailable relay ICE, fail-closed forced FIPS fallback, relay-only RTC config when relay ICE is available, and visible signaling-only button copy.

## Verification

- Red proof before implementation: focused route/capability tests failed because forced FIPS still started WebRTC and no config hook existed.
- `node --test test/action-visibility.test.js test/runtime-capabilities.test.js test/rtc-peer-signaling.test.js` -> 78/78 pass.
- `npm test` -> 302/302 pass.
- `npm run test:e2e` -> pass; local WebRTC, Nostr WebRTC, FIPS route-candidate-only, and federated Pollen-signaled WebRTC proof files delivered.
- `npm run test:docker` -> pass; Docker image built, `/config` served, FIPS/Pollen status passed, local Docker WebRTC and two-host Nostr WebRTC proof files delivered.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> exit 0; AI Slop/security/lint clean; existing `network.js` size/duplicate-block code-quality warnings remain outside touched hunks.
- `npx --yes aislop scan .` -> exit 1 on existing full-repo baseline warnings in noble vendored files, oversized files, `server/nostr-identity.js` hardcoded URL, TODO/empty-function info.

## Known Gap

Real overlay relay candidates for FIPS/Pollen remain unimplemented. The current slice is a fail-closed capability policy until a browser/runtime-proven relay path exists.
