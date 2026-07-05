# Mobile UAT Runbook

Use this runbook for the dependency-free mobile source artifacts built by `npm run build:ios` and
`npm run build:android`, plus the native wrapper source artifacts built by `npm run build:ios:native-source` and
`npm run build:android:native-source`, the Android debug APK artifact built by `npm run build:android:apk`, and the
UAT-signed Android release APK artifact built by `npm run build:android:release-apk`.

## Build

1. Run `npm run build:ios -- --version <version>`.
2. Run `npm run build:android -- --version <version>`.
3. Run `npm run build:ios:native-source -- --version <version>`.
4. Run `npm run build:android:native-source -- --version <version>`.
5. Run `npm run build:android:apk -- --version <version>`.
6. Run `npm run build:android:release-apk -- --version <version>`.
7. Confirm `dist/meshdrop-ios-<version>.tar.gz` and `dist/meshdrop-android-<version>.tar.gz` exist.
8. Confirm `dist/meshdrop-ios-native-source-<version>.tar.gz` and
   `dist/meshdrop-android-native-source-<version>.tar.gz` exist.
9. Confirm `dist/meshdrop-android-apk-<version>.tar.gz` exists.
10. Confirm `dist/meshdrop-android-release-apk-<version>.tar.gz` exists.
11. Confirm each archive contains `app/index.html`, `meshdrop-target.json`, a target README, and `UAT-MOBILE.md`.

## Artifact Acceptance

1. Confirm `meshdrop-target.json` reports `target` as `ios` or `android`.
2. Confirm `meshdrop-target.json` reports `runtime.platform` as `mobile`.
3. Confirm `meshdrop-target.json` reports `runtime.hasBackend` as `false` and `runtime.sharedInstance` as `false`.
4. Confirm `meshdrop-target.json` reports `nativeShellBuilt` as `false`.
5. For source artifacts, confirm `nativeShellSourceBuilt` is `false`.
6. For native-source artifacts, confirm `nativeShellSourceBuilt` is `true` and `nativeSource.sourceRoot` is present.
7. For Android APK artifacts, confirm `nativeShellBuilt` is `true`, `nativeShellSourceBuilt` is `true`, and
   `nativePackage.packageType` is `debug-apk` or `release-apk`.
8. Confirm backend-only transports are not claimed: `localDiscovery`, `pollen`, and `fips` are `false`.
9. Confirm `bluetooth` is `false` until a real mobile Bluetooth transport is implemented and tested.
10. Confirm browser-backed source artifacts report `webrtc`, `nostr`, `blossom`, and `hashtree` as `true`.
11. Confirm native-source artifacts do not claim unproven native transfer paths: `webrtc` and `nostr` are `false`.
12. Confirm Android APK artifacts report `webrtc` and `nostr` as `true` only after `npm run test:android-webview-transfer`
    passes for the installed debug APK path.
13. Confirm Android APK artifacts do not list Android share-sheet `ACTION_SEND` as remaining proof after
    `npm run test:android-share-file` passes.
14. Confirm Android APK artifacts do not list native file picker UI UAT as remaining proof after
    `npm run test:android-picker-ui` passes.

## Native Source Acceptance

1. Confirm the iOS native-source artifact contains `native/ios/MeshDrop/MeshDropViewController.swift`.
2. Confirm the iOS native-source artifact contains `native/ios/MeshDrop/Resources/meshdrop/index.html`.
3. Confirm the Android native-source artifact contains `native/android/app/src/main/AndroidManifest.xml`.
4. Confirm the Android native-source artifact contains
   `native/android/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`.
5. Confirm the Android native-source artifact contains `native/android/app/src/main/assets/meshdrop/index.html`.
6. Confirm both native wrapper sources inject `globalThis.__meshdropTargetManifest`.

## Android APK Acceptance

1. Confirm the Android APK artifact contains `apk/meshdrop-android-debug.apk`.
2. Confirm the Android APK artifact contains `apk/build-proof.json` with `gradleTask` set to `assembleDebug`.
3. Confirm the Android APK artifact contains `apk/output-metadata.json`.
4. Confirm `meshdrop-target.json` reports `nativePackage.path` as `apk/meshdrop-android-debug.apk`.
5. Confirm the debug APK is not treated as release signing proof: `nativePackage.releaseSigned` is `false`.

## Android Release APK Acceptance

1. Confirm the Android release APK artifact contains `apk/meshdrop-android-release.apk`.
2. Confirm the Android release APK artifact contains `apk/build-proof.json` with `gradleTask` set to
   `assembleRelease`.
3. Confirm `apk/build-proof.json` reports `releaseSigned` as `true`, `productionSigning` as `false`, and
   `signed` as `uat-release`.
4. Confirm `apk/build-proof.json` contains a SHA-256 digest for the APK and an `apksigner verify --print-certs`
   signature proof.
5. Confirm `meshdrop-target.json` reports `nativePackage.path` as `apk/meshdrop-android-release.apk`.
6. Confirm the release APK artifact does not list signed Android release APK proof as remaining Android proof.
7. Confirm the release APK artifact still lists physical Android device install UAT and Bluetooth negotiation as
   remaining proof.
8. Do not treat the generated UAT keystore as Play Store upload signing or AAB proof.

## Android Emulator Install Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-apk-install`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-apk-emulator-install`.
5. Confirm the proof names `farm.sandwich.meshdrop/.MainActivity`.

## Android WebView Capability Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-webview-capabilities`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-webview-capabilities`.
5. Confirm the proof reports `RTCPeerConnection`, `WebSocket`, and an `RTCDataChannel` probe from inside the installed
   Android WebView.
6. Confirm the proof reports `native transfer claim=true` after Android WebView transfer proof exists.

## Android WebView Transfer Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-webview-transfer`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-webview-nostr-webrtc`.
5. Confirm the proof names `farm.sandwich.meshdrop/.MainActivity`.
6. Confirm the proof says `meshdrop-android-webview-proof.txt` was delivered to a Chromium peer through a local fake
   relay.

## Android Share/File Input Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-share-file`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-share-file-nostr-webrtc`.
5. Confirm the proof names `farm.sandwich.meshdrop/.MainActivity`.
6. Confirm the proof says Android received an `ACTION_SEND` stream for `meshdrop-android-share-proof.txt` and delivered
   it to a Chromium peer through a local fake relay.
7. Confirm the generated Android wrapper contains `WebChromeClient.onShowFileChooser` so file inputs are wired to the
   native Android picker. Do not treat that source check as native picker UI UAT.

## Android Native Picker UI Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-picker-ui`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-picker-ui`.
5. Confirm the proof says native picker UI selected `meshdrop-picker-proof.txt` and returned it to
   `farm.sandwich.meshdrop/.MainActivity`.
6. This proves picker UI selection on the Android emulator path; it does not prove physical Android device UAT.

## Native Mobile Acceptance

1. Build a native iOS or Android app package from the matching native-source artifact.
2. Install the app on a physical device or emulator that supports WebRTC.
3. Confirm the app reads `meshdrop-target.json` and exposes `capabilities.runtime.target` as `ios` or `android`.
4. Configure a Nostr identity and transfer a small file over Nostr WebRTC to another MeshDrop peer.
5. Confirm the mobile file picker and share sheet can initiate a send.
6. Confirm Bluetooth remains hidden or disabled until implemented and negotiated.
7. Rebuild the app from a clean checkout before claiming the target is reproducible.

## Automated Smoke

Run:

```sh
npm run build:ios -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:ios:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android:apk -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android:release-apk -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
node --test test/mobile-package.test.js
npm run test:android-apk
npm run test:android-release-apk
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-apk-install
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-picker-ui
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-capabilities
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-transfer
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-share-file
npm run test:target-artifacts
```

This smoke proves source artifact shape, native-source wrapper source shape, target metadata, runtime capability metadata,
an Android debug APK build, a UAT-signed Android release APK build with `apksigner` proof, Android emulator
install/launch proof, native Android picker UI file selection, Android WebView runtime capability evidence, Android
WebView-to-Chromium Nostr WebRTC transfer through a local fake relay, Android `ACTION_SEND` file share delivery through
the same WebRTC send path, and real Nostr WebRTC transfers between two browser peers served from the generated iOS and
Android source artifacts.

## Not Proven

- The Android release APK artifact proves a release APK signed with a generated UAT keystore.
- These artifacts do not prove app-store packages, Play Store upload signing, AABs, or IPAs.
- The Android debug APK artifact alone does not prove install UAT; `npm run test:android-apk-install` provides the
  emulator install proof.
- Android WebView transfer proof does not prove physical Android device install UAT.
- These artifacts do not prove physical Android device install UAT.
- These artifacts do not prove native mobile WebRTC transfer UAT on iOS devices.
- These artifacts do not prove native iOS file-picker or share-sheet integration.
- These artifacts do not prove Bluetooth transport support.
