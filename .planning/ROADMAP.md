# Roadmap: MeshDrop v0.7.0 FIPS Stream Route Proof

## Phase 11: FIPS Stream Route Proof

Goal: transfer encrypted payload bytes over a FIPS-backed HTTP stream through the sender's FIPS mesh address and emit route proof.

Current status: complete.

Requirements: FIPS-STREAM-01, FIPS-STREAM-02, FIPS-STREAM-03, FIPS-STREAM-04, FIPS-STREAM-05.

Success criteria:

1. Focused tests fail first because no FIPS stream store/protocol/request path exists.
2. Server endpoints reject unavailable FIPS status and accept/download token-bound ciphertext only while the descriptor is live.
3. Browser FIPS stream descriptors and proof seeds validate against `MeshDropRouteContract`.
4. Recipient download/decrypt/hash verification emits route proof with `routeType=fips`, `dataPlanePrimitive=fips-http-stream`, `webRtcUsed=false`, `hashMatched=true`, and `fallbackUsed=false`.
5. Docker smoke proves two real FIPS daemons connect, recipient B fetches bytes from sender A's FIPS mesh IPv6 URL, and proof validates.

Verification:

- Focused: FIPS stream server/protocol tests.
- Runtime: `npm run test:fips-stream`.
- Broad local: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

These are not part of v0.5.0. Start a new GSD milestone for each slice after the previous PR is merged.

1. Generic instance relay: extend the Pollen-specific relay shape to FIPS, Tor, I2P, Loki, and future backends.
2. Additional networks: add Tor/I2P/Loki/TURN adapters through the same descriptor/scoring/proof model.

---
*Roadmap initialized: 2026-07-07 for milestone v0.7.0 FIPS Stream Route Proof.*
