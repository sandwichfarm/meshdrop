---
status: in_progress
quick_id: 260706-android-native-fips-pollen-backend
slug: android-native-fips-pollen-backend
date: 2026-07-06
---

# Quick Task 260706: Android Native FIPS/Pollen Backend

## Goal

Build a real Android-backed FIPS/Pollen path for the packaged Android WebView so controls are visible only when the native backend is alive, and Pollen upload/download plus FIPS status are exercised inside an installed APK.

## Scope

1. Keep the existing generated Android WebView UI.
2. Add an Android in-app backend endpoint surface for:
   - `GET /fips/status`
   - `GET /pollen/status`
   - `POST /pollen/upload`
   - `GET /pollen/download/:hash`
3. Route Android WebView fetches for those relative paths to the native backend, not to an external MeshDrop server.
4. Make Android runtime capability metadata reflect backend liveness rather than static FIPS/Pollen claims.
5. Add emulator smoke proof for FIPS status, Pollen status, Pollen upload/download round trip, and button visibility tied to backend liveness.
6. Update mobile/target-status UAT docs with proof status and remaining physical-device gap if any.

## Constraints

- Do not claim FIPS/Pollen Android completion unless an installed APK exercises the native-backed path.
- Keep diff narrow; current Android source generator emits Java, so prefer extending that generator unless converting to Kotlin is necessary.
- No new dependencies without explicit user request.
- Existing Android WebView Nostr/WebRTC/picker/share tests must keep passing.
- If real Rust FIPS JNI/UniFFI cannot be integrated in this slice without adding unrequested dependencies or external repo coupling, expose FIPS as native-backed status with explicit remaining Rust-core gap in docs/PR instead of fake completion language.

## Verification Plan

- `npm ci`
- `node --test test/mobile-package.test.js`
- new focused Android native backend unit/smoke tests
- `npm run test:android-apk`
- `MESHDROP_ANDROID_AVD=<avd> npm run test:android-webview-capabilities`
- `MESHDROP_ANDROID_AVD=<avd> npm run test:android-webview-transfer`
- new Android FIPS/Pollen smoke command
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
