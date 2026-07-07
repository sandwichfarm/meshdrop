# Phase 09 Summary: SPA Route Honesty

Date: 2026-07-07

Status: complete

## Delivered

- Static SPA runtime config fails closed for backend-only FIPS, Pollen, and same-instance route claims from manifest/build metadata alone.
- Peer route options now use negotiated runtime capabilities before exposing selectable routes.
- Peer-advertised FIPS/Pollen routes can still render as unavailable route attempts with "Requires instance or native app".
- `PeersManager` refuses runtime-unsupported backend-only route candidates before RTC peer creation or route switching.
- SPA artifact smoke now proves backend-free Nostr WebRTC transfer and checks backend-only route options stay unavailable.
- Browser transfer smoke keeps the default 20s route wait but gives federated Pollen discovery 60s because CI can need extra federation poll cycles before remote snapshots contain peers.
- ADR 0004 records the static/browser route boundary.

## Requirements

- SPA-01: complete
- SPA-02: complete
- SPA-03: complete
- SPA-04: complete
- SPA-05: complete
- SPA-06: complete
- SPA-07: complete

## Verification

- `node --test test/spa-runtime-config.test.js test/spa-artifact.test.js test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js test/route-attempts-ui.test.js` -> 64/64 passed
- `npm run test:spa-artifact` -> passed; `Proof backend-free-spa-nostr-webrtc:chromium: nostr delivered meshdrop-spa-proof.txt`
- `npm run test:e2e` -> passed; includes local, Blossom, Hashtree, Pollen storage, Nostr WebRTC, FIPS-candidate, federated Pollen WebRTC, and Pollen instance-relay proofs
- `npm test` -> 330/330 passed
- `git diff --check` -> passed
- `npx --yes aislop scan --changes .` -> exit 0; AI Slop/security/lint 0 issues; code-quality warnings remain for pre-existing large files and duplicate blocks in touched large modules
- `npx --yes aislop scan .` -> exit 1 baseline; top warnings are noble-ciphers unused expressions, large existing modules, duplicate existing blocks, and `server/nostr-identity.js:11` hardcoded URL

## Known Gaps

- Full-repo slop baseline is not clean in this repo family; this slice did not refactor existing large-file, vendored noble-ciphers, duplicate-block, or `server/nostr-identity.js` baseline warnings.
- Docker runtime was not rebuilt for this SPA-only route honesty slice; browser artifact smoke exercised the served static artifact directly.
