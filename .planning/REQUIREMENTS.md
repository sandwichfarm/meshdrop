# Requirements: MeshDrop v0.8.0 Generic Instance Relay

**Defined:** 2026-07-07
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

- Nostr WebRTC, local WebRTC, Blossom, Hashtree, Pollen storage, Pollen instance relay, and FIPS stream paths have automated transfer proof in the appropriate runtime targets.
- Runtime capability negotiation gates GUI controls by the current target's capabilities.
- Route descriptor validation, adapter vocabulary, scoring reasons, route attempts, and proof-backed completion copy exist.
- Backend-free SPA artifacts fail closed for backend-only FIPS/Pollen/native route claims while keeping pure-client Nostr WebRTC available.
- Installed Android APKs already expose a loopback native backend for FIPS status and Pollen upload/download.
- Pollen instance relay proves encrypted payload bytes through an object-store primitive and emits route proof.
- FIPS stream proof proves encrypted payload bytes over the sender's FIPS mesh IPv6 address and emits route proof.

## v0.8.0 Requirements

### Generic Instance Relay

- [x] **INST-GEN-01**: MeshDrop exposes a generic browser instance-relay protocol that builds v1 `transportShape=instance-relay` descriptors for any supported route type while enforcing owner pubkey, session ID, expiry, endpoint primitive, private/encrypted/fail-closed constraints, and `instanceRelay=true`.
- [x] **INST-GEN-02**: Generic instance-relay proof seeds and final route proofs require sender runtime, recipient runtime, route type, data-plane primitive, byte counts, `webRtcUsed=false`, `instanceRelayed=true`, `hashMatched=true`, and `fallbackUsed=false`.
- [x] **INST-GEN-03**: Generic instance-relay request validation rejects missing proof seed, missing owner/session binding, owner/session mismatch, expired descriptors, primitive mismatch, WebRTC byte-path claims, missing instance-relay flags, and fallback flags before any download/decrypt path can claim success.
- [x] **INST-GEN-04**: The existing Pollen instance-relay flow uses the generic instance-relay protocol without changing its public metadata shape, ciphertext upload/download behavior, route proof fields, or focused/browser runtime proof.
- [x] **INST-GEN-05**: ADRs document that this milestone generalizes relay descriptor/proof semantics only; it must not claim new FIPS/Tor/I2P/Loki byte-transfer support without route-specific runtime proof.

## Future Requirements

- **FIPS-RELAY-01**: FIPS instance relay moves encrypted chunks sender instance -> recipient instance over FIPS instead of requiring the recipient browser to fetch from the sender FIPS URL directly.
- **TOR-01**: Tor instance adapter exposes stream descriptors only when the instance can dial onion endpoints locally.
- **I2P-01**: I2P instance adapter exposes stream descriptors only when the instance can dial I2P destinations locally.
- **LOKI-01**: Loki instance adapter exposes stream descriptors only when the instance has a proven local Loki transport.
- **TURN-01**: WebRTC overlay relay candidates for FIPS/Pollen use TURN/TURNS routes only when the browser can dial the relay endpoint and relay-only ICE proof exists.

## Out of Scope

| Feature | Reason |
|---------|--------|
| New backend network support | This slice reduces duplicated relay proof logic before adding more transports. |
| FIPS instance-to-instance chunk relay | FIPS has direct FIPS stream proof; instance-to-instance relay is the next transport-specific slice. |
| Native FSP daemon API | Current FIPS release exposes ordinary IPv6/TCP through `fips0`; native FSP remains future work. |
| TURN overlay relay | Separate route type with different WebRTC proof needs. |
| Generic route-engine replacement | Existing runtime config and route-attempt surfaces are enough for this contract slice. |
| Public topology publication | Backend-only route availability must stay explicit, private, and proof-backed. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INST-GEN-01 | Phase 12 | Complete |
| INST-GEN-02 | Phase 12 | Complete |
| INST-GEN-03 | Phase 12 | Complete |
| INST-GEN-04 | Phase 12 | Complete |
| INST-GEN-05 | Phase 12 | Complete |

**Coverage:**
- v0.8.0 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after completing Phase 12 Generic Instance Relay.*
