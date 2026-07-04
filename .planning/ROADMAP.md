# Roadmap: MeshDrop

## Phase 1: Transfer Proof And Discovery Correctness

Goal: make WebRTC/discovery claims require real transfer proof and remove mock-only success paths.

- Maintain browser e2e coverage for local, FIPS, Pollen, Nostr, and federated FIPS transfers.
- Keep Nostr/FIPS/Pollen discovery scoped to npub networks.
- Add regression coverage when runtime proof finds signaling edge cases.

## Phase 2: Runtime Capability Negotiation

Goal: make GUI controls derive from runtime capabilities instead of hard-coded assumptions.

- Define capability schema for SPA, Docker, Start9/Umbrel, desktop, and mobile.
- Expose backend capability metadata through `/config`.
- Gate controls/toggles by capability and identity.

## Phase 3: Shared Instance Admin

Goal: allow a configured Docker admin npub to manage backend settings from the GUI with backend-verified signed Nostr requests.

- Configure admin npub in compose/runtime env.
- Verify admin Nostr events on backend before accepting settings changes.
- Gate admin settings UI to the configured admin identity.
- Support FIPS/backend config and safe restart requests through signed admin API.

## Phase 4: Platform Targets And UAT

Goal: make every target platform buildable and testable with explicit UAT runbooks.

- Docker standalone smoke and UAT.
- SPA capability-limited runtime.
- Start9/Umbrel packaging path.
- Desktop/mobile runtime feasibility and packaging plan.

## Phase 5: CI/CT/CD And Release Ceremony

Goal: make GitHub Actions and release automation reflect the real alpha shipping path.

- PR checks cover build/test/runtime smoke surfaces.
- Release flow avoids redundant CI when branch protection already proves the target.
- Tagged alpha releases produce GitHub releases and image/artifact outputs.

---
*Roadmap initialized: 2026-07-04 from goal objective.*
