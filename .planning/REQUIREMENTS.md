# Requirements: MeshDrop

**Defined:** 2026-07-04
**Core Value:** Files must transfer between peers reliably over every negotiated transport that claims to support the path.

## v1 Requirements

### Transfer Reliability

- [x] **TRNS-01**: Nostr WebRTC discovers followed npub peers without static room broadcast.
- [x] **TRNS-02**: FIPS and Pollen discovery are network-based through npub contacts, not static rooms.
- [ ] **TRNS-03**: Every claimed WebRTC path has deterministic transfer proof in automated smoke coverage.
- [ ] **TRNS-04**: Tests fail when signaling/discovery behavior is broadcast-only or mock-only.

### Runtime Negotiation

- [ ] **RUNT-01**: Frontend receives runtime capability data instead of assuming all transports exist.
- [ ] **RUNT-02**: GUI controls and toggles reflect negotiated runtime capabilities.
- [ ] **RUNT-03**: SPA/runtime targets do not expose backend-only controls unless the runtime supports them.

### Shared Instance Admin

- [ ] **ADMN-01**: Docker shared-instance admin npub can be configured through compose/runtime env.
- [ ] **ADMN-02**: `/config` exposes enough admin capability metadata for the frontend to gate controls.
- [ ] **ADMN-03**: Admin GUI controls are visible only to the configured admin identity.
- [ ] **ADMN-04**: Backend validates admin requests by verifying a Nostr event signed by the configured admin npub.
- [ ] **ADMN-05**: Signed admin requests can read/update FIPS/backend config and initiate safe restarts where supported.

### Platform And Release

- [ ] **PLAT-01**: Docker image build/run path has deterministic smoke and UAT proof.
- [ ] **PLAT-02**: SPA-only runtime has documented capability limits and UAT path.
- [ ] **PLAT-03**: Start9/Umbrel packaging targets have build and release artifacts.
- [ ] **PLAT-04**: Desktop/mobile target approach is planned with runtime capability model.
- [ ] **REL-01**: GitHub Actions CI/CT/CD runs necessary gates at PR/release points without redundant runs.
- [ ] **REL-02**: Tagged alpha releases produce GitHub releases and target artifacts/images.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Static FIPS/Pollen room env fallback | Explicitly rejected; alpha clean break. |
| Chat/social features beyond file sharing | Core value is one thing: share files. |
| Shared-instance admin semantics in SPA/native/mobile | These are single-user contexts in the objective. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRNS-01 | Completed PR #3 | Complete |
| TRNS-02 | Completed PR #5 | Complete |
| TRNS-03 | Phase 1 | In Progress |
| TRNS-04 | Phase 1 | In Progress |
| RUNT-01 | Phase 2 | Pending |
| RUNT-02 | Phase 2 | Pending |
| RUNT-03 | Phase 2 | Pending |
| ADMN-01 | Quick Task: admin-npub-signed-settings | In Progress |
| ADMN-02 | Quick Task: admin-npub-signed-settings | In Progress |
| ADMN-03 | Quick Task: admin-npub-signed-settings | In Progress |
| ADMN-04 | Quick Task: admin-npub-signed-settings | In Progress |
| ADMN-05 | Phase 3 | Pending |
| PLAT-01 | Phase 4 | Pending |
| PLAT-02 | Phase 4 | Pending |
| PLAT-03 | Phase 4 | Pending |
| PLAT-04 | Phase 4 | Pending |
| REL-01 | Phase 5 | Pending |
| REL-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases/tasks: 18
- Unmapped: 0

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-04 after initializing GSD project state from the goal objective.*
