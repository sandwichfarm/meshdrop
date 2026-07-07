# Roadmap: MeshDrop v0.8.0 Generic Instance Relay

## Phase 12: Generic Instance Relay

Goal: extract the proven Pollen instance-relay descriptor/proof semantics into a reusable generic protocol without changing live Pollen behavior or claiming new network support.

Current status: complete.

Requirements: INST-GEN-01, INST-GEN-02, INST-GEN-03, INST-GEN-04, INST-GEN-05.

Success criteria:

1. Focused tests fail first because no generic `InstanceRelayTransferProtocol` exists.
2. Generic instance-relay descriptors validate owner/session/expiry/primitive/capability constraints through `MeshDropRouteContract`.
3. Generic instance-relay proof seeds and finalized proofs reject fallback, WebRTC byte-path claims, missing runtimes, byte/hash mismatch, and missing instance relay flags.
4. Pollen instance-relay tests still pass with the existing public request shape while delegating descriptor/proof validation to the generic protocol.
5. ADR 0006 records the generic relay boundary and explicitly forbids new transport support claims without byte-transfer proof.

Verification:

- Focused: generic instance-relay protocol tests plus existing Pollen instance-relay tests.
- Runtime: `npm run test:e2e` if browser transfer code or script load order changes.
- Broad local: `npm test` before PR if code changes touch shared route contract or transfer flow.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

1. FIPS instance relay: move encrypted chunks sender instance -> recipient instance over FIPS using the generic relay contract.
2. Additional networks: add Tor/I2P/Loki adapters through the same descriptor/scoring/proof model.
3. TURN overlay relay: add relay-only ICE proof only where the browser can actually dial the relay path.

---
*Roadmap updated: 2026-07-07 after completing milestone v0.8.0 Generic Instance Relay.*
