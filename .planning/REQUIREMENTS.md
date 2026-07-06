# Requirements: MeshDrop

**Defined:** 2026-07-04
**Core Value:** Files must transfer between peers reliably over every negotiated transport that claims to support the path.

## v1 Requirements

### Transfer Reliability

- [x] **TRNS-01**: Nostr WebRTC discovers followed npub peers without static room broadcast.
- [x] **TRNS-02**: FIPS and Pollen discovery are network-based through npub contacts, not static rooms.
- [x] **TRNS-03**: Every claimed WebRTC path has deterministic transfer proof in automated smoke coverage.
- [x] **TRNS-04**: Tests fail when signaling/discovery behavior is broadcast-only or mock-only.

### Runtime Negotiation

- [x] **RUNT-01**: Frontend receives runtime capability data instead of assuming all transports exist.
- [x] **RUNT-02**: GUI controls and toggles reflect negotiated runtime capabilities.
- [x] **RUNT-03**: SPA/runtime targets do not expose backend-only controls unless the runtime supports them.

### Shared Instance Admin

- [x] **ADMN-01**: Docker shared-instance admin npub can be configured through compose/runtime env.
- [x] **ADMN-02**: `/config` exposes enough admin capability metadata for the frontend to gate controls.
- [x] **ADMN-03**: Admin GUI controls are visible only to the configured admin identity.
- [x] **ADMN-04**: Backend validates admin requests by verifying a Nostr event signed by the configured admin npub.
- [x] **ADMN-05**: Signed admin requests can read/update FIPS/backend config and initiate safe restarts where supported.

### Platform And Release

- [x] **PLAT-01**: Docker image build/run path has deterministic smoke and UAT proof.
- [x] **PLAT-02**: SPA-only runtime has documented capability limits and UAT path.
- [x] **PLAT-03**: Start9/Umbrel packaging targets have build and release artifacts.
- [x] **PLAT-04**: Desktop/mobile target approach is planned with runtime capability model.
- [x] **REL-01**: GitHub Actions CI/CT/CD runs necessary gates at PR/release points without redundant runs.
- [ ] **REL-02**: Tagged alpha releases produce GitHub releases and target artifacts/images.

REL-02 remains open for the current `master` head because the latest merged artifact set is not yet present in a
published tag and anonymous GHCR readback still fails with `unauthorized`.

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
| TRNS-03 | Phase 1 | Complete |
| TRNS-04 | Phase 1 | Complete |
| RUNT-01 | Phase 2 | Complete |
| RUNT-02 | Phase 2 | Complete |
| RUNT-03 | Phase 2 | Complete |
| ADMN-01 | Quick Task: admin-npub-signed-settings | Complete |
| ADMN-02 | Quick Task: admin-npub-signed-settings | Complete |
| ADMN-03 | Quick Task: admin-npub-signed-settings | Complete |
| ADMN-04 | Quick Task: admin-npub-signed-settings | Complete |
| ADMN-05 | Phase 3 | Complete |
| PLAT-01 | Phase 4 | Complete |
| PLAT-02 | Phase 4 | Complete |
| PLAT-03 | Phase 4 | Complete |
| PLAT-04 | Phase 4 | Complete |
| REL-01 | Phase 5 | Complete |
| REL-02 | Phase 5 | Open |

## Remaining Proof Gaps

- Current `master` has not been released after PR #105. A new `v0.*.*` tag must publish and read back the latest target artifacts.
- Anonymous GHCR readback fails for `v0.1.4` with `unauthorized`; the active token also lacks `read:packages`, so this session cannot inspect or change package visibility.
- Real-device/node UAT remains open for StartOS, Umbrel, and signed iOS device packages.

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases/tasks: 18
- Unmapped: 0

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-06 after auditing merged PRs #1-#105, `v0.1.4`, and GHCR anonymous readback.*
