# Requirements: MeshDrop v0.4.0 Route Attempts UX

**Defined:** 2026-07-07
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

- Nostr WebRTC discovers followed npub peers without static room broadcast.
- FIPS and Pollen discovery are network-based through npub contacts, not static rooms.
- Claimed WebRTC, Blossom, Hashtree, Pollen storage, and Pollen instance-relay paths have deterministic transfer proof in automated smoke coverage.
- Runtime capability negotiation gates GUI controls by target/runtime capability.
- Route descriptor validation, adapter vocabulary, scoring reasons, and proof fields exist from v0.2.0.
- Pollen instance relay proves encrypted bytes can cross two MeshDrop instances with `webRtcUsed: false`, `instanceRelayed: true`, matching byte counts, and hash match.

## v0.4.0 Requirements

### Route Attempts

- [x] **UX-01**: User can see a compact list of candidate file routes for a peer or active transfer, including direct, Nostr, instance, FIPS, Pollen, and object-store routes when those routes are relevant.
- [x] **UX-02**: User can see the current route attempt state using the route contract vocabulary: candidate, requested, accepted, connecting, transferring, complete, unavailable, rejected, expired, failed, or blocked fallback.
- [x] **UX-03**: User can see clear failure or unavailable reasons without protocol jargon: needs Nostr sign-in, peer not trusted, requires instance, requires native app, overlay network unavailable, peer route expired, or fallback disabled by privacy policy.

### Privacy And Proof

- [x] **UX-04**: User can see privacy/data-path labels for each route attempt: end-to-end encrypted, direct data path, relayed by your instance, relayed by peer instance, backend-only route, public discovery enabled, or public discovery disabled.
- [x] **UX-05**: Completed transfer UI uses route proof fields to show the route that actually carried bytes and does not show a route as successful from discovery, descriptor, or badge state alone.

### Runtime Honesty

- [x] **UX-06**: Unsupported backend-only routes are hidden or disabled unless runtime capabilities and transfer primitives prove they are usable in the current target.
- [x] **UX-07**: Automated tests cover route-attempt copy and state mapping so stale or optimistic badges cannot regress into false transfer claims.

## Future Requirements

- **FIPS-01**: FIPS adapter transfers encrypted file bytes over a FIPS-backed data plane and reports route proof.
- **SPA-01**: Backend-free SPA artifacts fail closed for backend-only routes and never claim FIPS/Pollen byte transfer without a reachable data plane.
- **NATIVE-01**: Android native adapter exposes real native route status, descriptor, transfer primitive, and proof.
- **INST-GENERIC-01**: The Pollen-specific relay path is generalized for FIPS, Tor, I2P, Loki, and future backends after one backend is proven.

## Out of Scope

| Feature | Reason |
|---------|--------|
| FIPS byte transfer implementation | This milestone explains and displays route attempts; it does not add a new FIPS data plane. |
| Replacing all transfer internals with a generic route engine | The UI can consume existing status/proof surfaces before the full engine rewrite. |
| New transport protocols | Tor, I2P, Loki, TURN, and FIPS stream routes remain future adapter slices. |
| Marketing-style protocol education | UI copy should explain user-visible state, not teach transport internals. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 8 | Complete |
| UX-02 | Phase 8 | Complete |
| UX-03 | Phase 8 | Complete |
| UX-04 | Phase 8 | Complete |
| UX-05 | Phase 8 | Complete |
| UX-06 | Phase 8 | Complete |
| UX-07 | Phase 8 | Complete |

**Coverage:**
- v0.4.0 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after implementing Phase 8 Route Attempts UX.*
