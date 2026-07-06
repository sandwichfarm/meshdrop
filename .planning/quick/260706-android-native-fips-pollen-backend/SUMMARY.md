---
status: complete
quick_id: 260706-android-native-fips-pollen-backend
slug: android-native-fips-pollen-backend
date: 2026-07-06
---

# Quick Task 260706 Summary: Android Native FIPS/Pollen Backend

## Result

The generated Android APK now starts an in-app loopback backend before loading the WebView and injects
`globalThis.__meshdropAndroidNativeBackend` with its local base URL.

Implemented native-backed endpoints:

- `GET /fips/status`
- `GET /pollen/status`
- `POST /pollen/upload`
- `GET /pollen/download/:hash`

The WebView FIPS/Pollen clients route relative endpoint fetches through that injected native backend URL when present.
Android FIPS/Pollen controls are enabled only when the Android native backend is alive.

## Intentional Remaining Gaps

- Native Android Rust FIPS core integration is not complete. The installed APK status returns `rustCore=false` and
  `rust-fips-core-not-linked` instead of pretending JNI/UniFFI is wired.
- Native Android Pollen WASM/pln integration is not complete. The installed APK proves an Android-native object store
  upload/download round trip, not pln/WASM semantics.

## Evidence

- `npm ci`
- `node --test test/mobile-package.test.js test/pollen-transfer-protocol.test.js test/fips-discovery-protocol.test.js`
- `npm run test:android-apk`
- `npm run test:android-release-apk`
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-capabilities`
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-fips-pollen`
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-transfer`
- `node --test test/spa-runtime-config.test.js`
- `node --test test/uat-runbooks.test.js`
- `npm test`

Android runtime proof:

- `Proof android-webview-capabilities: farm.sandwich.meshdrop/.MainActivity exposed RTCPeerConnection=function, WebSocket=function, RTCDataChannel label=meshdrop-probe, manifest target=android, native backend=http://127.0.0.1:39539, native transfer claim=true, FIPS visible=true, Pollen visible=true, Bluetooth API=undefined, Bluetooth transfer=false on emulator-5580`
- `Proof android-fips-pollen: farm.sandwich.meshdrop/.MainActivity served FIPS status from android-native with rustCore=false, Pollen uploaded/downloaded af5720edddfb17622e7bc374cac6a266da7e29fa9e7167b5aaffa56fadc94a48 via http://127.0.0.1:35695 on emulator-5580`
- `Proof android-webview-nostr-webrtc: farm.sandwich.meshdrop/.MainActivity delivered meshdrop-android-webview-proof.txt to Chromium peer through local fake relay on emulator-5580`
