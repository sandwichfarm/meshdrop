# Roadmap: MeshDrop v0.2.0 Route Adapter Contract

## Phase 6: Route Contract And Test Harness

Goal: introduce the shared route descriptor, adapter, proof, and scoring contract that later transport slices must satisfy, without changing live route selection or claiming new data-plane support.

Current status: complete locally; PR/CI/merge still pending.

Requirements: ROUTE-01, ROUTE-02, ROUTE-03, ADAPT-01, ADAPT-02, ADAPT-03, SCORE-01, SCORE-02, PROOF-01, ADR-01, TEST-01.

Success criteria:

1. `public/scripts/route-contract.js` or equivalent exposes descriptor validation, adapter validation, route proof field validation, and deterministic candidate scoring through a public browser-safe surface.
2. Tests prove descriptors reject unsupported shapes, expired timestamps, wrong sessions, and wrong owner/trust bindings.
3. Tests prove existing room-based FIPS/Pollen descriptors are accepted as a legacy route descriptor shape without changing the live route manager.
4. Tests prove route scoring is deterministic and explainable while preserving current runtime behavior.
5. ADR documents Nostr as control plane, routes as data-plane adapters, identity separation, fail-closed route claims, and route proof requirements.

Verification:

- Focused: `node --test test/route-contract.test.js test/nostr-mesh-protocol.test.js test/signaling-room-priority.test.js test/pollen-transfer-protocol.test.js`
- Broad local: `npm test`
- Hygiene: `git diff --check`
- AI-slop: `npx --yes aislop scan --changes .`

## Future Milestone Queue

These are not part of v0.2.0. Start a new GSD milestone for each slice after the previous PR is merged.

1. Instance relay over one backend: choose FIPS or Pollen and prove encrypted chunks cross two instances with hash match and route proof.
2. UX for route attempts: show route choices, route failure reasons, unsupported routes, and privacy labels.
3. SPA route honesty: pure-client routes remain enabled while backend-only routes are unavailable or instance-dependent.
4. Android native adapter: expose native FIPS/Pollen status and transfer primitives through the route adapter contract.
5. Additional networks: add Tor, I2P, Loki, or TURN adapters only through the same descriptor/scoring/proof model.

---
*Roadmap initialized: 2026-07-07 for milestone v0.2.0 Route Adapter Contract.*
