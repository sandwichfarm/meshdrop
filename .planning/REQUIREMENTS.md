# Requirements: MeshDrop v0.5.0 SPA Route Honesty

**Defined:** 2026-07-07
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

- Nostr WebRTC, local WebRTC, Blossom, Hashtree, Pollen storage, and Pollen instance-relay paths have automated transfer proof in the appropriate runtime targets.
- Runtime capability negotiation gates GUI controls by the current target's capabilities.
- Route descriptor validation, adapter vocabulary, scoring reasons, route attempts, and proof-backed completion copy exist.
- Backend-only FIPS/Pollen relay and native routes are not proven in browser-only SPA targets.

## v0.5.0 Requirements

### Static Runtime Capabilities

- [ ] **SPA-01**: Static SPA target manifests report pure-client browser routes as available only when the browser/runtime can exercise them: Nostr WebRTC over normal ICE and enabled browser/object-store transfer paths.
- [ ] **SPA-02**: Static SPA target manifests do not report backend-only FIPS, Pollen instance relay, or native adapter transfer support from server status, build metadata, discovery descriptors, or protocol badges alone.
- [ ] **SPA-03**: Static config negotiation preserves explicit unavailable reasons for backend-only routes, including "requires instance" and "requires native app".

### Route Choice Honesty

- [ ] **SPA-04**: Backend-free SPA route choice UI cannot offer FIPS, Pollen instance relay, or native-only routes as selectable file transports unless a reachable browser/OS route or instance/object-store primitive is present.
- [ ] **SPA-05**: Backend-free SPA route attempts may show peer-advertised private routes as unavailable/instance-dependent, but cannot render those routes as connected, transferring, or complete without route proof.

### Proof And Regression Coverage

- [ ] **SPA-06**: Automated SPA artifact tests prove pure-client routes still transfer files after backend-only routes are disabled or marked unavailable.
- [ ] **SPA-07**: Automated tests fail if a backend-free SPA artifact claims FIPS/Pollen byte transfer support from discovery, descriptor exchange, badge state, or native build metadata alone.

## Future Requirements

- **FIPS-01**: FIPS adapter transfers encrypted file bytes over a FIPS-backed data plane and reports route proof.
- **NATIVE-01**: Android native adapter exposes real native route status, descriptor, transfer primitive, and proof.
- **INST-GENERIC-01**: The Pollen-specific relay path is generalized for FIPS, Tor, I2P, Loki, and future backends after one backend is proven.
- **TURN-01**: WebRTC overlay relay candidates for FIPS/Pollen use TURN/TURNS routes only when the browser can dial the relay endpoint and relay-only ICE proof exists.

## Out of Scope

| Feature | Reason |
|---------|--------|
| FIPS byte-transfer implementation | This milestone prevents false SPA claims; the FIPS data plane remains a later transport slice. |
| Android/iOS native transport adapters | Native adapters need runtime bridges and device proof; this milestone is static/browser SPA only. |
| Generic route-engine replacement | Existing runtime config and route-attempt surfaces are enough to enforce SPA honesty. |
| Public topology publication | Backend-only route availability must stay explicit, private, and proof-backed. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPA-01 | Phase 9 | Pending |
| SPA-02 | Phase 9 | Pending |
| SPA-03 | Phase 9 | Pending |
| SPA-04 | Phase 9 | Pending |
| SPA-05 | Phase 9 | Pending |
| SPA-06 | Phase 9 | Pending |
| SPA-07 | Phase 9 | Pending |

**Coverage:**
- v0.5.0 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after starting Phase 9 SPA route honesty.*
