# Roadmap: MeshDrop v0.4.0 Route Attempts UX

## Phase 8: Route Attempts UX

Goal: show route choices, attempt state, unavailable reasons, privacy labels, and proof-backed completion in the MeshDrop UI without exposing protocol internals or claiming unsupported routes.

Current status: implemented locally; PR/CI/merge pending.

Requirements: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07.

Success criteria:

1. A focused test fails first because route-attempt state/reason/privacy mapping is not exposed to the UI, then passes after implementation.
2. Peer or transfer UI can render candidate, requested, connecting, transferring, complete, unavailable, failed, expired, and blocked-fallback states from structured route status.
3. Unavailable backend-only routes show honest reasons or stay disabled/hidden when the current runtime cannot transfer bytes through them.
4. Completed transfer details are driven by route proof fields and name the route that actually carried bytes.
5. UI copy explains user-visible route status and privacy labels without leaking route descriptor internals.
6. Existing e2e transfer proof still passes with the new UI state surface present.

Verification:

- Focused: route-attempt UX/state tests plus existing route contract tests.
- Runtime: `npm run test:e2e` for browser transfer behavior and route proof.
- Broad local: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

These are not part of v0.4.0. Start a new GSD milestone for each slice after the previous PR is merged.

1. SPA route honesty: pure-client routes remain enabled while backend-only routes are unavailable or instance-dependent.
2. FIPS instance relay or FIPS stream route proof.
3. Android native adapter: expose native FIPS/Pollen status and transfer primitives through the route adapter contract.
4. Additional networks: add Tor, I2P, Loki, TURN, or future adapters only through the same descriptor/scoring/proof model.

---
*Roadmap initialized: 2026-07-07 for milestone v0.4.0 Route Attempts UX.*
