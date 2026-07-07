# Requirements: MeshDrop v0.2.0 Route Adapter Contract

**Defined:** 2026-07-07
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

The v0.1.x milestone already proved current claimed paths and runtime gates:

- Nostr WebRTC discovers followed npub peers without static room broadcast.
- FIPS and Pollen discovery are network-based through npub contacts, not static rooms.
- Current claimed WebRTC paths have deterministic transfer proof in automated smoke coverage.
- Runtime capability negotiation gates GUI controls by target/runtime capability.
- Docker shared-instance admin controls are gated by configured admin npub and backend-verified signed Nostr events.
- Release automation publishes/readbacks alpha target artifacts and GHCR images with authenticated GitHub Actions package access.

## v0.2.0 Requirements

### Route Contract

- [x] **ROUTE-01**: Code exposes a shared route descriptor contract for version, route type, transport shape, session ID, owner pubkey, expiration, endpoint metadata, constraints, capabilities, and proof metadata.
- [x] **ROUTE-02**: Descriptor validation rejects missing required fields, unsupported transport shapes, expired descriptors, wrong-session descriptors, and descriptors not bound to the expected trusted owner.
- [x] **ROUTE-03**: Existing room-based FIPS/Pollen private route descriptors remain representable as a legacy descriptor shape without changing live route behavior.

### Adapter Contract

- [x] **ADAPT-01**: Code exposes a minimum route adapter contract vocabulary: status, capabilities, descriptorFor, acceptDescriptor, send/openStream, receive, close, and proof.
- [x] **ADAPT-02**: Adapter validation distinguishes unsupported, unavailable, and available runtimes so future UI/runtime gates can fail closed.
- [x] **ADAPT-03**: Contract terms keep user npubs, transport npubs, and service identities separate.

### Scoring And Proof

- [x] **SCORE-01**: Code exposes deterministic route candidate scoring that favors already-connected direct routes, user preference, trusted private routes, available routes, lower relay/object cost, and runtime support.
- [x] **SCORE-02**: Scoring output includes machine-readable reasons so UX can explain candidate, selected, unavailable, failed, and fallback states.
- [x] **PROOF-01**: Contract documents the route proof fields every later data-plane slice must report: sender runtime, recipient runtime, selected route type, data-plane primitive, WebRTC use, instance relay use, bytes sent/received, hash match, and fallback status.

### Governance

- [x] **ADR-01**: An ADR records why MeshDrop treats Nostr as control plane and transport routes as pluggable data-plane adapters.
- [x] **TEST-01**: Behavior-first tests cover descriptor validation, expiration, trust binding, adapter shape, and scoring before implementation.

## Future Requirements

Deferred to later GSD milestones, one slice at a time:

- **FIPS-01**: FIPS adapter transfers encrypted file bytes over a FIPS-backed data plane and reports route proof.
- **POLLEN-01**: Pollen adapter transfers encrypted file bytes through upload/download or service substrate behavior and reports route proof.
- **INST-01**: Instance relay adapter forwards encrypted chunks between instances without seeing plaintext and reports route proof.
- **UX-01**: UI explains route attempts, unavailable states, and privacy labels without exposing protocol internals.
- **SPA-01**: Backend-free SPA artifacts fail closed for backend-only routes and never claim FIPS/Pollen byte transfer without a reachable data plane.
- **NATIVE-01**: Android native adapter exposes real native route status, descriptor, transfer primitive, and proof.

## Out of Scope

| Feature | Reason |
|---------|--------|
| FIPS byte transfer implementation | Slice 2; Slice 1 must not confuse contract introduction with transport proof. |
| Pollen byte transfer rewrite | Slice 2 or 3; existing Pollen endpoint behavior stays intact. |
| Live route selection rewrite | Current signaling route priority is already tested; Slice 1 adds scoring helpers without changing runtime behavior. |
| Tor/I2P/Loki adapters | Future adapter slices after FIPS/Pollen/instance relay prove the contract. |
| Public topology publication | Private routes use encrypted, short-lived descriptors unless a user explicitly chooses public sharing. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | Phase 6 | Complete |
| ROUTE-02 | Phase 6 | Complete |
| ROUTE-03 | Phase 6 | Complete |
| ADAPT-01 | Phase 6 | Complete |
| ADAPT-02 | Phase 6 | Complete |
| ADAPT-03 | Phase 6 | Complete |
| SCORE-01 | Phase 6 | Complete |
| SCORE-02 | Phase 6 | Complete |
| PROOF-01 | Phase 6 | Complete |
| ADR-01 | Phase 6 | Complete |
| TEST-01 | Phase 6 | Complete |

**Coverage:**
- v0.2.0 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after implementing Phase 6 route contract and test harness.*
