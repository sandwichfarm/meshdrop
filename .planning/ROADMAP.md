# Roadmap: MeshDrop v0.5.0 SPA Route Honesty

## Phase 9: SPA Route Honesty

Goal: make backend-free SPA artifacts and static runtime config fail closed for backend-only FIPS/Pollen/native routes while preserving pure-client transfer paths.

Current status: planned.

Requirements: SPA-01, SPA-02, SPA-03, SPA-04, SPA-05, SPA-06, SPA-07.

Success criteria:

1. Focused tests fail first because static SPA runtime capability negotiation or route choice can still imply backend-only FIPS/Pollen/native transfer support.
2. Static SPA manifests and config expose only browser-available transfer primitives as selectable routes.
3. FIPS/Pollen instance relay/native routes render unavailable or instance/native-dependent unless the current target has a reachable transfer primitive.
4. Route-attempt UI can display peer-advertised backend-only routes without showing connected/transferring/complete state absent route proof.
5. SPA artifact browser smoke still transfers a proof file over pure-client Nostr WebRTC after backend-only route claims are blocked.

Verification:

- Focused: static config/runtime capability tests plus route-attempt/availability tests.
- Runtime: `npm run test:spa-artifact` and the smallest route-choice browser proof needed by touched behavior.
- Broad local: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

These are not part of v0.5.0. Start a new GSD milestone for each slice after the previous PR is merged.

1. FIPS instance relay or FIPS stream route proof.
2. Android native adapter: expose native FIPS/Pollen status and transfer primitives through the route adapter contract.
3. Generic instance relay: extend the Pollen-specific relay shape to FIPS, Tor, I2P, Loki, and future backends.
4. Additional networks: add Tor/I2P/Loki/TURN adapters through the same descriptor/scoring/proof model.

---
*Roadmap initialized: 2026-07-07 for milestone v0.5.0 SPA Route Honesty.*
