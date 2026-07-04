---
status: complete
created: 2026-07-04
slug: umbrel-package-smoke
---

# Quick Task: Umbrel Package Smoke

## Goal

Prove the generated Umbrel package can be installed through its rendered Docker Compose file and serve real transfer paths.

## Scope

- Add `npm run test:umbrel-package`.
- Build the Umbrel image locally with `MESHDROP_TARGET=umbrel`.
- Build and unpack the Umbrel package artifact.
- Run the rendered package compose with a local override that publishes port 3000.
- Verify `/config` reports target `umbrel`.
- Reuse the browser transfer smoke to prove local and Pollen WebRTC transfers.
- Update UAT status without claiming real Umbrel device install.

## Out Of Scope

- Real Umbrel node UI install.
- Public relay UAT.
- GHCR package visibility.
- StartOS or native desktop/mobile gaps.

## Validation

- Red/green command wiring test.
- Local Umbrel package compose smoke.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
