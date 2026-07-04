---
status: complete
quick_id: 260704-dnt
slug: desktop-native-source-artifact
date: 2026-07-04
---

# Quick Task 260704-dnt: Desktop Native Source Artifact

## Goal

Create the first dependency-free Desktop Native target artifact so the target is no longer blank in the build matrix.
This must not claim a native shell binary or desktop transfer UAT yet.

## Scope

1. Add a `build:desktop` artifact builder that packages MeshDrop desktop source assets and a target manifest.
2. Add a Desktop Native UAT runbook that states the current proof boundary and the remaining shell/UAT gap.
3. Add tests that guard artifact contents, runtime capability metadata, and target-status wording.
4. Update `.planning/STATE.md` and `docs/uat/target-status.md` without overstating completion.

## Out Of Scope

- Adding Tauri, Electron, or any other new dependency.
- Building a native installer or desktop executable.
- Claiming desktop WebRTC transfer UAT.

## Verification

- `node --test test/desktop-package.test.js test/runtime-capabilities.test.js test/uat-runbooks.test.js` passed: 6/6.
- `npm run build:desktop -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke` produced
  `/tmp/meshdrop-desktop-smoke/meshdrop-desktop-0.0.0-smoke.tar.gz`.
- Archive readback confirmed `meshdrop-target.json` has `target: desktop`, `nativeShellBuilt: false`, backend-only
  transports disabled, and remaining proof for native shell build, transfer UAT, and installer/binary.
- `npm test` passed: 169/169.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still exits nonzero on the existing repo-wide baseline: undefined browser globals,
  existing `innerHTML` security findings in `public/scripts/ui.js`, and style/complexity warnings.
