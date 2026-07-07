# Roadmap: MeshDrop v0.9.0 FIPS Instance Relay

## Phase 13: FIPS Instance Relay

Goal: apply the generic instance-relay descriptor/proof contract to the existing encrypted FIPS byte path without breaking legacy `fipsStream` requests.

Current status: complete.

Requirements: FIPS-IR-01, FIPS-IR-02, FIPS-IR-03, FIPS-IR-04, FIPS-IR-05.

Success criteria:

1. Focused tests fail first because FIPS has only legacy stream descriptor/proof semantics.
2. FIPS builds generic instance-relay descriptors and proof seeds from the same encrypted upload descriptors used by the FIPS stream path.
3. Private FIPS request metadata includes both `fipsInstanceRelay` and legacy `fipsStream`.
4. Recipient download prefers `fipsInstanceRelay`, emits `instanceRelayed=true`, and rejects unsafe claims before decrypting/success.
5. Legacy `fipsStream`-only requests still download and emit legacy proof.

Verification:

- Focused: FIPS stream transfer tests plus generic and Pollen instance-relay regression tests.
- Runtime: `npm run test:fips-stream` over two FIPS-backed instances.
- Browser: `npm run test:e2e` because browser transfer metadata and proof routing change.
- Broad local: `npm test`.
- Docker: `npm run test:docker`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

1. Additional networks: add Tor/I2P/Loki adapters through the same descriptor/scoring/proof model.
2. TURN overlay relay: add relay-only ICE proof only where the browser can actually dial the relay path.

---
*Roadmap updated: 2026-07-07 after completing milestone v0.9.0 FIPS Instance Relay.*
