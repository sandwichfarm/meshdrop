---
status: in_progress
quick_id: 260706-android-native-core-tool-hooks
slug: android-native-core-tool-hooks
date: 2026-07-06
---

# Quick Task 260706: Android Native Core Tool Hooks

## Goal

Move the Android native backend closer to the requested real FIPS/Pollen implementation by adding build-time and runtime hooks
for packaged Android native core tools.

## Scope

1. Let Android package builds include per-ABI native `fips`, `fipsctl`, and `pln` executables when paths are supplied by env.
2. Extract those tools from APK assets at app startup and make them executable in app-private storage.
3. Delegate Android Pollen status/upload/download to packaged `pln` when present.
4. Delegate Android FIPS status to packaged `fipsctl` when present.
5. Keep existing object-store fallback and explicit gaps when native tools are absent.
6. Add package/source tests that prove the generated APK source contains the native-tool extraction and delegation paths.

## Constraints

- Do not claim final FIPS/Pollen Android completion unless installed APK proof exercises real packaged native tools.
- No new dependencies.
- FIPS Android compilation is not proven locally: `cargo check --target x86_64-linux-android --bin fipsctl` failed because the active `1.94.1` toolchain lacks Android std components.
- Current `pln` found locally is `/home/sandwich/go/bin/pln`, an x86_64 Linux binary, not Android.

## Verification Plan

- `node --test test/mobile-package.test.js`
- `npm run test:android-apk`
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-fips-pollen`
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-transfer`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
