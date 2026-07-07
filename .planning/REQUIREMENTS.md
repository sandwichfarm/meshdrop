# Requirements: MeshDrop v0.3.0 Pollen Instance Relay Proof

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

## Validated v0.2.0 Requirements

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

## v0.3.0 Requirements

### Pollen Instance Relay

- [x] **PIR-01**: Sender browser can hand encrypted file chunks to its local MeshDrop instance for a Pollen instance-relay route without exposing plaintext bytes to the instance.
- [x] **PIR-02**: Sender instance can forward encrypted chunks to the recipient instance through Pollen-backed upload/download or service substrate behavior.
- [x] **PIR-03**: Recipient browser can retrieve the encrypted chunks from its local MeshDrop instance, decrypt locally, and verify the original file hash.
- [x] **PIR-04**: The route proof for a successful transfer names sender runtime, recipient runtime, route type `pollen`, data-plane primitive, `webRtcUsed: false`, `instanceRelayed: true`, bytes sent, bytes received, hash match, and `fallbackUsed: false`.

### Contract And Failure Behavior

- [x] **PIR-05**: Pollen instance relay uses the shared `RouteDescriptor`/adapter/proof vocabulary from v0.2.0 instead of a Pollen-only special case.
- [x] **PIR-06**: Missing Pollen runtime, expired descriptors, wrong session, wrong owner, hash mismatch, or any fallback attempt fails closed and does not report transfer support.
- [x] **PIR-07**: Tests distinguish discovery/signaling success from byte-transfer success; a route candidate or peer descriptor alone cannot satisfy this milestone.

### Runtime Proof

- [x] **PIR-08**: Automated runtime proof exercises two MeshDrop instances and proves encrypted bytes crossed the selected Pollen instance-relay data plane.
- [x] **PIR-09**: Docker or compose-visible runtime proof rebuilds/runs the service and proves served source/container state matches the tested commit when Docker-visible behavior changes.

## Future Requirements

Deferred to later GSD milestones, one slice at a time:

- **FIPS-01**: FIPS adapter transfers encrypted file bytes over a FIPS-backed data plane and reports route proof.
- **POLLEN-STREAM-01**: Pollen grows a stream-mode adapter if the Pollen substrate exposes a suitable primitive beyond object/chunk relay.
- **INST-GENERIC-01**: The Pollen-specific relay path is generalized for FIPS, Tor, I2P, Loki, and future backends after one backend is proven.
- **UX-01**: UI explains route attempts, unavailable states, and privacy labels without exposing protocol internals.
- **SPA-01**: Backend-free SPA artifacts fail closed for backend-only routes and never claim FIPS/Pollen byte transfer without a reachable data plane.
- **NATIVE-01**: Android native adapter exposes real native route status, descriptor, transfer primitive, and proof.

## Out of Scope

| Feature | Reason |
|---------|--------|
| FIPS byte transfer implementation | Next backend slice after Pollen proves the instance-relay shape. |
| Live route selection rewrite for every route | This milestone wires one proven instance-mediated backend path before broader route-engine replacement. |
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
| PIR-01 | Phase 7 | Complete |
| PIR-02 | Phase 7 | Complete |
| PIR-03 | Phase 7 | Complete |
| PIR-04 | Phase 7 | Complete |
| PIR-05 | Phase 7 | Complete |
| PIR-06 | Phase 7 | Complete |
| PIR-07 | Phase 7 | Complete |
| PIR-08 | Phase 7 | Complete |
| PIR-09 | Phase 7 | Complete |

**Coverage:**
- v0.3.0 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after starting Phase 7 Pollen instance relay proof.*
