# Roadmap: MeshDrop v0.12.0 Route Blocker Issue Tracking

## Phase 16: Route Blocker Issue Tracking

Goal: move the remaining route-expansion, release-readback, and deployed-target blockers from stale GSD/PR text into live GitHub issues with acceptance criteria.

Current status: complete.

Requirements: BLOCKER-01, BLOCKER-02, BLOCKER-03, BLOCKER-04, BLOCKER-05.

Success criteria:

1. GitHub issue tracker availability is verified for `sandwichfarm/meshdrop`.
2. Existing route proof blockers are read back from GitHub: https://github.com/sandwichfarm/meshdrop/issues/151 and https://github.com/sandwichfarm/meshdrop/issues/152.
3. Missing finish-line blockers are created and read back: GHCR anonymous readback (#156), deployed StartOS/Umbrel UAT (#157), and signed iOS device/share-transfer UAT (#158).
4. GSD and ADR docs link every active blocker issue and remove stale issue-disabled wording.
5. Runtime route claims remain fail-closed until each issue's acceptance proof exists.

Verification:

- Focused: `node --test test/route-blocker-issues.test.js` proves blocker issue links are recorded and stale disabled-tracker wording is gone.
- Live GitHub: `gh repo view sandwichfarm/meshdrop --json hasIssuesEnabled,viewerPermission` and `gh issue view 151 152 156 157 158`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- GitHub reports issues enabled with admin permission.
- Existing route blockers read back:
  - https://github.com/sandwichfarm/meshdrop/issues/151
  - https://github.com/sandwichfarm/meshdrop/issues/152
- New blocker issues created:
  - https://github.com/sandwichfarm/meshdrop/issues/156
  - https://github.com/sandwichfarm/meshdrop/issues/157
  - https://github.com/sandwichfarm/meshdrop/issues/158

## Future Milestone Queue

1. Tor/I2P/Loki byte-transfer proof with real local daemon/proxy dial evidence. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/151.
2. FIPS/Pollen route-specific WebRTC relay proof using the generic TURN proof harness once a relay endpoint is reachable through those overlays. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/152.
3. GHCR anonymous release image readback once package visibility or authenticated distribution policy is decided. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/156.
4. Deployed StartOS/Umbrel UAT once real installed service URLs are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/157.
5. Signed iOS device/share-transfer UAT once macOS signing hardware and a real device are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/158.

---
*Roadmap updated: 2026-07-07 completing milestone v0.12.0 Route Blocker Issue Tracking.*
