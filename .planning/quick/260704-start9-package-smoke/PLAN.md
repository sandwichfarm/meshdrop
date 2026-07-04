---
status: complete
created: 2026-07-04
slug: start9-package-smoke
---

# Quick Task: Start9 Package Smoke

## Goal

Prove the generated Start9 package source environment can boot the Start9-target image locally and serve real transfer
paths.

## Scope

- Add `npm run test:start9-package`.
- Build the Start9 image locally with `MESHDROP_TARGET=start9`.
- Build and unpack the Start9 package source artifact.
- Read the generated `startos/main.ts` and `startos/utils.ts` environment and port configuration.
- Run the target image locally with the generated Start9 environment.
- Verify `/config` reports target `start9`.
- Reuse the browser transfer smoke to prove local and Pollen WebRTC transfers.
- Update UAT status without claiming real StartOS device install.

## Out Of Scope

- Real StartOS device UI install.
- Public relay UAT.
- GHCR package visibility.
- Native desktop/mobile gaps.

## Validation

- Red/green command wiring test.
- Local Start9 generated-env Docker smoke.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
