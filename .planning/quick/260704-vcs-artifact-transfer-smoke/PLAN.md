---
status: in_progress
created: 2026-07-04
slug: artifact-transfer-smoke
---

# Quick Task: Artifact Transfer Smoke

## Goal

Prove the generated Desktop, iOS, and Android source artifacts can initiate real Nostr WebRTC file transfers when served as static runtimes.

## Scope

- Add an automated smoke command for desktop/mobile artifacts.
- Reuse existing static artifact and fake-relay patterns where possible.
- Update UAT runbooks and target status with the exact proof boundary.

## Out Of Scope

- Native desktop shell implementation.
- iOS or Android native app shells.
- Installers, signed binaries, app-store packages, and device UAT.
- Bluetooth transport implementation.
- GHCR package visibility changes.

## Validation

- Focused artifact transfer smoke.
- Existing desktop/mobile package tests.
- `npm test`.
- `git diff --check`.
- Changed-code AI-slop scan.
- Full-repo AI-slop baseline report.
