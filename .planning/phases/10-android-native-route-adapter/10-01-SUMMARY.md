# Phase 10 Summary: Android Native Route Adapter

Date: 2026-07-07

Status: complete

## Delivered

- Added a contract-valid Android native route adapter loaded by the WebView app.
- Adapter is unsupported when the Android loopback native backend is unavailable.
- Adapter exposes native Pollen object-store/pln send, receive, descriptor, and route proof behavior.
- Adapter exposes FIPS native status as status-only and keeps `transferSupported: false` for FIPS byte transfer.
- Android package readback proves the adapter script ships with app assets while generated Java still injects only backend metadata.
- Installed APK smoke now validates Android native Pollen route proof through `MeshDropRouteContract.validateRouteProof`.
- ADR 0005 records the Android native adapter boundary.

## Requirements

- ANDROID-NATIVE-01: complete
- ANDROID-NATIVE-02: complete
- ANDROID-NATIVE-03: complete
- ANDROID-NATIVE-04: complete
- ANDROID-NATIVE-05: complete

## Verification

- `node --test test/android-native-route-adapter.test.js` -> 3/3 passed
- `node --test test/mobile-package.test.js` -> 5/5 passed
- `node --test test/android-native-route-adapter.test.js test/mobile-package.test.js` -> 8/8 passed
- `ANDROID_HOME=/home/sandwich/Android/Sdk ANDROID_SDK_ROOT=/home/sandwich/Android/Sdk MESHDROP_ANDROID_AVD='Medium_Phone_API_36.1' npm run test:android-fips-pollen` -> passed; route proof `sender=android-webview:127.0.0.1:41981`, `recipient=android-webview:127.0.0.1:41981`, `route=pollen`, `primitive=android-native-object-store`, `webrtc=false`, `instanceRelay=false`, `bytes=26/26`, `hashMatched=true`, `fallback=false`
- `npm test` -> 333/333 passed
- `git diff --check` -> passed
- `npx --yes aislop scan --changes .` -> exit 0 for tracked changed files; new adapter/test files were also covered by `npm test`

## Known Gaps

- FIPS remains status-only in this adapter. FIPS byte transfer still needs a FIPS data-plane proof.
- Runtime proof used the default Android object store backend, not packaged `pln` or Rust FIPS binaries.
