---
phase: 06-route-contract-and-test-harness
plan: 01
subsystem: route-contract
tags: [routing, descriptors, adapters, proof, scoring]
provides:
  - Shared route descriptor validation contract
  - Legacy room descriptor representation
  - Route adapter availability validation
  - Deterministic candidate scoring
  - Route proof validation
affects: [route-expansion, fips, pollen, instance-relay, native]
tech-stack:
  added: []
  patterns: [browser global helper, node:test regression]
key-files:
  created:
    - public/scripts/route-contract.js
    - test/route-contract.test.js
    - docs/adr/0001-route-adapter-contract.md
  modified:
    - public/scripts/main.js
    - public/service-worker.js
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - "Nostr remains the control plane; byte transports become route adapters."
  - "Legacy room descriptors stay representable but live route selection is unchanged."
completed: 2026-07-07
---

# Phase 6: Route Contract And Test Harness Summary

Route expansion now has a shared contract surface and tests, without claiming new FIPS/Pollen byte-transfer behavior.

## Accomplishments

- Added `MeshDropRouteContract` with descriptor validation, legacy room descriptor representation, adapter availability validation, deterministic scoring, and route proof validation.
- Loaded the contract in the browser deferred script list and cached it in the service worker.
- Added behavior-first tests covering valid descriptors, invalid/expired/wrong-binding descriptors, legacy room descriptors, adapter surface, scoring, and proof rejection.
- Recorded ADR 0001 for Nostr-as-control-plane and route-adapters-as-data-plane.

## Verification

- `node --test test/route-contract.test.js` -> 6/6 pass.
- `node --test test/route-contract.test.js test/nostr-mesh-protocol.test.js test/signaling-room-priority.test.js test/pollen-transfer-protocol.test.js` -> 32/32 pass.
- `npm ci` -> dependencies installed, 0 vulnerabilities.
- `npm test` -> 317/317 pass.
- `npm run test:e2e` -> browser smoke passed; local, Blossom, Hashtree, Pollen storage, Nostr WebRTC, generic FIPS route candidate, and federated Pollen WebRTC proof logged.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> clean run, 100/100.

## Remaining Shipping Gates

- PR push/readback/CI/merge to `master`

## Next Phase Readiness

Next milestone can start Slice 2: choose one backend, then prove encrypted bytes move across the selected data plane with route proof.
