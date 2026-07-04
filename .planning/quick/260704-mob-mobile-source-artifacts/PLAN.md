---
status: complete
quick_id: 260704-mob
slug: mobile-source-artifacts
date: 2026-07-04
---

# Quick Task 260704-mob: Mobile Source Artifacts

## Goal

Create dependency-free iOS and Android source artifacts so both mobile targets have build-script surfaces, target
manifests, and UAT runbooks without claiming native apps or transfer UAT.

## Scope

1. Add mobile source artifact builders for `ios` and `android`.
2. Add mobile UAT documentation that states native shell, app package, Bluetooth, and transfer proof gaps.
3. Add tests for artifact shape, manifest contents, and target-status wording.
4. Update `.planning/STATE.md` and `docs/uat/target-status.md`.

## Out Of Scope

- Adding Capacitor, React Native, native Swift/Kotlin, or any other new dependency.
- Building app-store packages, signed mobile binaries, or native file-picker/share-sheet integrations.
- Claiming mobile WebRTC or Bluetooth transfer UAT.

## Verification

- `node --test test/mobile-package.test.js test/runtime-capabilities.test.js test/uat-runbooks.test.js` passed: 9/9.
- `npm run build:ios -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke` produced
  `/tmp/meshdrop-mobile-smoke/meshdrop-ios-0.0.0-smoke.tar.gz`.
- `npm run build:android -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke` produced
  `/tmp/meshdrop-mobile-smoke/meshdrop-android-0.0.0-smoke.tar.gz`.
- Archive readback confirmed both target manifests have `nativeShellBuilt: false`, `runtime.platform: mobile`,
  backend-only transports disabled, `bluetooth: false`, and remaining proof for native mobile shells and transfer UAT.
- `npm test` passed: 173/173.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still exits nonzero on the existing repo-wide baseline: undefined browser globals,
  existing `innerHTML` security findings in `public/scripts/ui.js`, and style/complexity warnings.
