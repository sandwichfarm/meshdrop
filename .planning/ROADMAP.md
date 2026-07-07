# Roadmap: MeshDrop v0.3.0 Pollen Instance Relay Proof

## Phase 7: Pollen Instance Relay Proof

Goal: prove encrypted file bytes can move from one browser to another through two MeshDrop instances using Pollen as the selected backend data plane, with route proof and no silent fallback.

Current status: implemented locally; broad gates still pending.

Requirements: PIR-01, PIR-02, PIR-03, PIR-04, PIR-05, PIR-06, PIR-07, PIR-08, PIR-09.

Success criteria:

1. A focused test fails first because no Pollen instance-relay byte path/proof exists, then passes after implementation.
2. Sender-side code accepts only encrypted chunks for the relay route and records bytes sent without plaintext exposure.
3. Instance relay forwarding uses Pollen-backed upload/download or service substrate behavior between two instances.
4. Recipient-side code retrieves chunks, decrypts in the browser/client boundary, verifies hash, and records bytes received.
5. Route proof reports `routeType: "pollen"`, `webRtcUsed: false`, `instanceRelayed: true`, equal byte counts, hash match, and no fallback.
6. Missing runtime, bad descriptor/session/owner, hash mismatch, and fallback attempts fail closed.
7. Browser/runtime or Docker proof exercises real message flow, not just unit mocks.

Verification:

- Focused: add/run Pollen instance-relay transfer tests plus existing `test/pollen-transfer-protocol.test.js`.
- Runtime: `npm run test:e2e` and/or `npm run test:docker` depending on touched runtime surface.
- Broad local: `npm test`
- Hygiene: `git diff --check`
- AI-slop: `npx --yes aislop scan --changes .`

## Future Milestone Queue

These are not part of v0.3.0. Start a new GSD milestone for each slice after the previous PR is merged.

1. FIPS instance relay or FIPS stream route proof.
2. UX for route attempts: show route choices and route failure reasons.
3. SPA route honesty: pure-client routes remain enabled while backend-only routes are unavailable or instance-dependent.
4. Android native adapter: expose native FIPS/Pollen status and transfer primitives through the route adapter contract.
5. Additional networks: add Tor, I2P, Loki, or TURN adapters only through the same descriptor/scoring/proof model.

---
*Roadmap initialized: 2026-07-07 for milestone v0.3.0 Pollen Instance Relay Proof.*
