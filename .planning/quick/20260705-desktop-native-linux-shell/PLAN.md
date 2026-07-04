---
status: complete
created: 2026-07-05
slug: desktop-native-linux-shell
---

# Quick Task: Desktop Native Linux Shell

## Goal

Move Desktop Native from source-only toward a real native target by compiling a Linux GTK/WebKit shell artifact.

## Scope

- Add a dependency-free C GTK/WebKit shell source under `packaging/desktop/`.
- Add `npm run build:desktop:native` to compile and package `bin/meshdrop-desktop` with app assets.
- Guard the artifact by extracting the tarball and running the binary in config-print mode.
- Add the native Linux desktop artifact to alpha release creation and release readback.
- Update UAT docs and target status without claiming native WebRTC transfer UAT or signed installer proof.

## Out Of Scope

- Native desktop WebRTC transfer UAT through the GTK/WebKit window.
- Signed installers or cross-platform desktop packages.
- Mobile native shells.

## Validation

- Red/green `node --test test/desktop-package.test.js`.
- Workflow guard tests.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
