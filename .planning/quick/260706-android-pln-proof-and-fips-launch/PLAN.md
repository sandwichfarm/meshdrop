---
status: in_progress
quick_id: 260706-android-pln-proof-and-fips-launch
slug: android-pln-proof-and-fips-launch
date: 2026-07-06
---

# Quick Task 260706: Android pln Proof And FIPS Launch Plumbing

## Goal

Move the installed Android APK proof from object-store fallback toward real native-core behavior by exercising an Android
`pln` binary in the emulator and by adding native FIPS daemon launch plumbing for supplied Android `fips`/`fipsctl`
binaries.

## Scope

1. Build or reuse an Android x86_64 `pln` binary for emulator proof.
2. Package that binary into the generated Android APK through the existing per-ABI env hook.
3. Adjust the generated Android backend if the current `pln` CLI invocation shape is wrong.
4. Add Android backend startup plumbing that starts packaged `fips` with app-private config/control paths before querying
   `fipsctl`.
5. Keep FIPS completion unclaimed until a real Android FIPS binary runs inside the installed APK.

## Constraints

- `pln` cross-build now succeeds locally with NDK 27.2.12479018.
- FIPS Android build still fails in upstream FIPS code after the Android std/linker blockers were removed; current errors are
  target-platform cfg gaps in ethernet/TUN/DNS modules.
- Do not fake FIPS status to satisfy the hard rule.

## Verification Plan

- Local `pln` CLI shape probe.
- Android APK smoke with packaged x86_64 `pln`, proving `android-native-pln` from installed WebView.
- Existing Android WebView transfer smoke.
- `node --test test/mobile-package.test.js test/uat-runbooks.test.js test/spa-runtime-config.test.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
