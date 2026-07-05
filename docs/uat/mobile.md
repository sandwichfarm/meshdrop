# Mobile UAT Runbook

Use this runbook for the dependency-free mobile source artifacts built by `npm run build:ios` and
`npm run build:android`, plus the native wrapper source artifacts built by `npm run build:ios:native-source` and
`npm run build:android:native-source`, plus the Android debug APK artifact built by `npm run build:android:apk`.

## Build

1. Run `npm run build:ios -- --version <version>`.
2. Run `npm run build:android -- --version <version>`.
3. Run `npm run build:ios:native-source -- --version <version>`.
4. Run `npm run build:android:native-source -- --version <version>`.
5. Run `npm run build:android:apk -- --version <version>`.
6. Confirm `dist/meshdrop-ios-<version>.tar.gz` and `dist/meshdrop-android-<version>.tar.gz` exist.
7. Confirm `dist/meshdrop-ios-native-source-<version>.tar.gz` and
   `dist/meshdrop-android-native-source-<version>.tar.gz` exist.
8. Confirm `dist/meshdrop-android-apk-<version>.tar.gz` exists.
9. Confirm each archive contains `app/index.html`, `meshdrop-target.json`, a target README, and `UAT-MOBILE.md`.

## Artifact Acceptance

1. Confirm `meshdrop-target.json` reports `target` as `ios` or `android`.
2. Confirm `meshdrop-target.json` reports `runtime.platform` as `mobile`.
3. Confirm `meshdrop-target.json` reports `runtime.hasBackend` as `false` and `runtime.sharedInstance` as `false`.
4. Confirm `meshdrop-target.json` reports `nativeShellBuilt` as `false`.
5. For source artifacts, confirm `nativeShellSourceBuilt` is `false`.
6. For native-source artifacts, confirm `nativeShellSourceBuilt` is `true` and `nativeSource.sourceRoot` is present.
7. For Android APK artifacts, confirm `nativeShellBuilt` is `true`, `nativeShellSourceBuilt` is `true`,
   and `nativePackage.packageType` is `debug-apk`.
8. Confirm backend-only transports are not claimed: `localDiscovery`, `pollen`, and `fips` are `false`.
9. Confirm `bluetooth` is `false` until a real mobile Bluetooth transport is implemented and tested.
10. Confirm browser-backed source artifacts report `webrtc`, `nostr`, `blossom`, and `hashtree` as `true`.
11. Confirm native-source and Android APK artifacts do not claim unproven native transfer paths: `webrtc` and `nostr`
    are `false`.

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

## Android Emulator Install Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-apk-install`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-apk-emulator-install`.
5. Confirm the proof names `farm.sandwich.meshdrop/.MainActivity`.

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
node --test test/mobile-package.test.js
npm run test:android-apk
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-apk-install
npm run test:target-artifacts
```

This smoke proves source artifact shape, native-source wrapper source shape, target metadata, runtime capability metadata,
an Android debug APK build, Android emulator install/launch proof, and real Nostr WebRTC transfers between two browser
peers served from the generated iOS and Android source artifacts.

## Not Proven

- These artifacts do not prove signed app-store packages, release APKs, AABs, or IPAs.
- The Android debug APK artifact alone does not prove install UAT; `npm run test:android-apk-install` provides the
  emulator install proof.
- These artifacts do not prove physical Android device install UAT.
- These artifacts do not prove native mobile WebRTC transfer UAT on iOS or Android devices.
- These artifacts do not prove native mobile file-picker or share-sheet integration.
- These artifacts do not prove Bluetooth transport support.
