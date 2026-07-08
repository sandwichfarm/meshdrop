# Phase 20 Summary: Overlay Relay Proof Preflight

Status: Complete.

## Delivered

- Hardened route proof validation so FIPS/Pollen/Tor/I2P/Loki `webrtc-relay-ice` proofs require route-specific topology evidence.
- Kept generic `turn-relay` WebRTC proof behavior unchanged.
- Added `scripts/overlay-relay-preflight.mjs` and `npm run test:overlay-relay-preflight`.
- Added preflight validation for route-specific TURN/TURNS config, matching overlay name, matching relay endpoint, and explicit `provenTransfer=false`.
- Recorded ADR 0012 and updated GSD roadmap/requirements/state for Phase 20.

## Evidence

- Red guard failed until the route-contract topology guard, preflight script, and package script existed.
- `node --test test/route-contract.test.js test/overlay-relay-preflight.test.js test/docker-smoke-script.test.js test/route-blocker-issues.test.js` -> 21/21 pass.
- Configured `npm run test:overlay-relay-preflight` emitted `preflight-ready` with matching FIPS relay endpoints, issue #152 blocker URL, and `provenTransfer=false`.
- `npm test` -> 375/375 pass.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.

## Remaining Gaps

- FIPS/Pollen WebRTC overlay byte transfer is still not proven.
- Issue #152 remains open until a real relay endpoint reachable through FIPS/Pollen carries browser bytes with selected `relay` candidates and no Clearnet fallback.
