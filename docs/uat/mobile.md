# Mobile UAT Runbook

Use this runbook for the dependency-free mobile source artifacts built by `npm run build:ios` and
`npm run build:android`, plus the native wrapper source artifacts built by `npm run build:ios:native-source` and
`npm run build:android:native-source`, the Android debug APK artifact built by `npm run build:android:apk`, and the
UAT-signed Android release APK artifact built by `npm run build:android:release-apk`, and the unsigned iOS Simulator
app artifact built by `npm run build:ios:simulator-app`, and the unsigned iOS device app artifact built by
`npm run build:ios:device-app`.

## Build

1. Run `npm run build:ios -- --version <version>`.
2. Run `npm run build:android -- --version <version>`.
3. Run `npm run build:ios:native-source -- --version <version>`.
4. Run `npm run build:android:native-source -- --version <version>`.
5. Run `npm run build:android:apk -- --version <version>`.
6. Run `npm run build:android:release-apk -- --version <version>`.
7. On macOS with Xcode installed, run `npm run build:ios:simulator-app -- --version <version>`.
8. On macOS with Xcode installed, run `npm run build:ios:device-app -- --version <version>`.
9. Confirm `dist/meshdrop-ios-<version>.tar.gz` and `dist/meshdrop-android-<version>.tar.gz` exist.
10. Confirm `dist/meshdrop-ios-native-source-<version>.tar.gz` and
   `dist/meshdrop-android-native-source-<version>.tar.gz` exist.
11. Confirm `dist/meshdrop-ios-simulator-app-<version>.tar.gz` exists.
12. Confirm `dist/meshdrop-ios-device-app-<version>.tar.gz` exists.
13. Confirm `dist/meshdrop-android-apk-<version>.tar.gz` exists.
14. Confirm `dist/meshdrop-android-release-apk-<version>.tar.gz` exists.
15. Confirm each source archive contains `app/index.html`, `meshdrop-target.json`, a target README, and `UAT-MOBILE.md`.

## Artifact Acceptance

1. Confirm `meshdrop-target.json` reports `target` as `ios` or `android`.
2. Confirm `meshdrop-target.json` reports `runtime.platform` as `mobile`.
3. Confirm `meshdrop-target.json` reports `runtime.hasBackend` as `false` and `runtime.sharedInstance` as `false`.
4. Confirm `meshdrop-target.json` reports `nativeShellBuilt` as `false`.
5. For source artifacts, confirm `nativeShellSourceBuilt` is `false`.
6. For native-source artifacts, confirm `nativeShellSourceBuilt` is `true` and `nativeSource.sourceRoot` is present.
7. For Android APK artifacts, confirm `nativeShellBuilt` is `true`, `nativeShellSourceBuilt` is `true`, and
   `nativePackage.packageType` is `debug-apk` or `release-apk`.
8. Confirm backend-only transports are not claimed in source/native-source artifacts: `localDiscovery`, `pollen`, and
   `fips` are `false`.
9. Confirm Android APK artifacts report `pollen` and `fips` as `true` only with remaining proof entries for native
   Android Rust FIPS core integration and native Android Pollen WASM/pln integration.
10. Confirm `bluetooth` is `false` until a real mobile Bluetooth transport is implemented and tested.
11. For iOS native-source artifacts, confirm `capabilities.transports.bluetooth` reports `supported` and
    `transferSupported` as `false`, with `apiAvailable` and `nativeBridgeAvailable` also `false`.
12. Confirm browser-backed source artifacts report `webrtc`, `nostr`, `blossom`, and `hashtree` as `true`.
13. Confirm native-source artifacts do not claim unproven native transfer paths: `webrtc` and `nostr` are `false`.
14. Confirm Android APK artifacts report `webrtc` and `nostr` as `true` only after `npm run test:android-webview-transfer`
    passes for the installed debug APK path.
15. Confirm Android APK artifacts do not list Android share-sheet `ACTION_SEND` as remaining proof after
    `npm run test:android-share-file` passes.
16. Confirm Android APK artifacts do not list native file picker UI UAT as remaining proof after
    `npm run test:android-picker-ui` passes.
17. Confirm Android native-source/APK builds may include per-ABI native core tools only when explicit absolute paths are
    supplied through `MESHDROP_ANDROID_FIPS_<ABI>`, `MESHDROP_ANDROID_FIPSCTL_<ABI>`, and `MESHDROP_ANDROID_PLN_<ABI>`,
    where `<ABI>` is `ARM64_V8A`, `ARMEABI_V7A`, or `X86_64`.

## Native Source Acceptance

1. Confirm the iOS native-source artifact contains `native/ios/MeshDrop/MeshDropViewController.swift`.
2. Confirm the iOS native-source artifact contains `native/ios/MeshDrop/Resources/meshdrop/index.html`.
3. Confirm the iOS native-source artifact contains `native/ios/MeshDrop.xcodeproj/project.pbxproj` and a
   shared `MeshDrop.xcscheme`.
4. On macOS with Xcode installed, run `npm run test:ios-xcode-build` and confirm the generated `MeshDrop` scheme builds
   for iOS Simulator without code signing.
5. Confirm the iOS native-source wrapper sets `WKUIDelegate` and uses the iOS 18.4+ `WKOpenPanelParameters` hook with
   `UIDocumentPickerViewController` for WKWebView file inputs.
6. Confirm the iOS native-source artifact includes a share extension source scaffold at
   `native/ios/MeshDropShareExtension/ShareViewController.swift`.
7. Confirm the iOS share extension `Info.plist` declares `com.apple.share-services`,
   `NSExtensionActivationRule`, and `NSExtensionActivationSupportsFileWithMaxCount`.
8. Confirm the iOS project references matching App Group entitlement files for the containing app and share extension.
9. Confirm the iOS share extension and containing app source use the same App Group identifier and stage files through
   `share-inbox.json`.
10. Confirm the iOS containing app injects `globalThis.__meshdropSharedFiles` and exposes
   `globalThis.meshdropShareInbox.list()` and `globalThis.meshdropShareInbox.read(name)` from the App Group
   `share-inbox.json` manifest.
11. Confirm the web app consumes the native share inbox by converting staged App Group file responses into `File`
   objects and firing `activate-share-mode`.
12. Confirm the Android native-source artifact contains `native/android/app/src/main/AndroidManifest.xml`.
13. Confirm the Android native-source artifact contains
   `native/android/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`.
14. Confirm the Android native-source artifact contains `native/android/app/src/main/assets/meshdrop/index.html`.
15. Confirm both native wrapper sources inject `globalThis.__meshdropTargetManifest`.

## Android APK Acceptance

1. Confirm the Android APK artifact contains `apk/meshdrop-android-debug.apk`.
2. Confirm the Android APK artifact contains `apk/build-proof.json` with `gradleTask` set to `assembleDebug`.
3. Confirm the Android APK artifact contains `apk/output-metadata.json`.
4. Confirm `meshdrop-target.json` reports `nativePackage.path` as `apk/meshdrop-android-debug.apk`.
5. Confirm the debug APK is not treated as release signing proof: `nativePackage.releaseSigned` is `false`.

## iOS Simulator App Acceptance

1. Confirm the iOS Simulator app artifact contains `MeshDrop.app/Info.plist`.
2. Confirm the iOS Simulator app artifact contains `build-proof.json`.
3. Confirm `build-proof.json` reports `packageType` as `unsigned-simulator-app`.
4. Confirm `build-proof.json` reports `sdk` as `iphonesimulator` and `codeSigningAllowed` as `false`.
5. Do not treat this artifact as App Store, TestFlight, signed-device, App Group provisioning, picker UAT, or native
   transfer proof.

## iOS Device App Acceptance

1. Confirm the iOS device app artifact contains `MeshDrop.app/Info.plist`.
2. Confirm the artifact contains `build-proof.json`.
3. Confirm `build-proof.json` reports `packageType` as `unsigned-device-app`.
4. Confirm `build-proof.json` reports `sdk` as `iphoneos`, `destination` as `generic/platform=iOS`, and
   `codeSigningAllowed` as `false`.
5. Confirm `build-proof.json` reports `deviceInstallable` and `appStoreReady` as `false`.
6. Do not treat this artifact as a signed IPA, App Store/TestFlight package, App Group provisioning proof, picker UAT,
   share-sheet UAT, or native transfer proof.

## iOS Signed Device Install Acceptance

1. Attach a physical iOS device to a macOS host with Xcode installed and trusted for development.
2. Set `MESHDROP_IOS_DEVELOPMENT_TEAM=<team-id>` and `MESHDROP_IOS_DEVICE_UDID=<device-udid>`.
3. Optionally set `MESHDROP_IOS_SIGNING_IDENTITY=<installed identity>`,
   `MESHDROP_IOS_PROVISIONING_PROFILE=<profile-name>`, and `MESHDROP_IOS_ALLOW_PROVISIONING_UPDATES=1`.
4. Run `npm run test:ios-signed-device`.
5. Confirm the smoke prints `Proof ios-signed-device-install`.
6. Confirm the proof says App Group entitlements were inspected and the signed app installed and launched through
   `devicectl`.
7. With the app launched after installing the share extension, share a small file into MeshDrop from Files or Photos.
8. In Web Inspector or an equivalent signed-device debug surface, confirm `globalThis.__meshdropSharedFiles` lists the
   staged file and `await globalThis.meshdropShareInbox.read("<staged-name>")` returns base64 content for it.
9. Confirm the MeshDrop page enters share mode for the staged file after the native `meshdrop:shared-files` event.
10. Do not treat this as App Store/TestFlight proof, device file-picker UAT, share-sheet transfer UAT, or native transfer
   UAT until the shared file is sent to another MeshDrop peer.

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
7. Confirm the release APK artifact still lists physical Android device install UAT as remaining proof.
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
7. Confirm the proof reports the actual Web Bluetooth API type and `Bluetooth transfer=false` from the negotiated
   runtime capabilities inside the installed Android WebView.

## Android WebView Transfer Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-webview-transfer`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-webview-nostr-webrtc`.
5. Confirm the proof names `farm.sandwich.meshdrop/.MainActivity`.
6. Confirm the proof says `meshdrop-android-webview-proof.txt` was delivered to a Chromium peer through a local fake
   relay.

## Android Native FIPS/Pollen Backend Acceptance

1. Start an Android emulator or attach an Android device.
2. Run `npm run test:android-fips-pollen`.
3. If no device is already attached, set `MESHDROP_ANDROID_AVD=<avd-name>` to launch a local AVD in headless read-only
   mode for the smoke.
4. Confirm the smoke prints `Proof android-fips-pollen`.
5. Confirm the proof reports an installed APK serving `GET /fips/status`, `GET /pollen/status`, `POST /pollen/upload`,
   and `GET /pollen/download/:hash` through a `127.0.0.1` Android-native backend.
6. Confirm the proof says FIPS status came from `android-native` and `rustCore=false`; do not treat this as Rust FIPS
   core integration.
7. Confirm the proof uploads and downloads `android-native-pollen-proof` from inside the installed WebView.
8. Do not treat this as Pollen WASM/pln proof until the Android backend uses that substrate instead of the in-app
   native object store.
9. If Android-native `fipsctl` or `pln` binaries are supplied during packaging, confirm the installed APK packages them
   as `jniLibs/<abi>/libmeshdrop_<tool>.so`, executes them from the app native library directory, and proof output reports
   `android-native-fipsctl` or `android-native-pln` instead of the fallback object-store path.
10. When `pln` is supplied, confirm the installed APK starts `pln up --port 0` from app-private state before Pollen
    status, upload, or download claims are recorded.
11. Current emulator proof for Android `pln` uses an x86_64 binary built from `/home/sandwich/Develop/pollen` with
    NDK 27.2.12479018 and runs:
    `MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-fips-pollen`.

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

## Android Physical Device Acceptance

1. Attach one physical Android device over ADB, or set `MESHDROP_ANDROID_SERIAL=<serial>` when multiple devices are
   connected.
2. Run `npm run test:android-physical-device`.
3. Confirm the harness rejects emulator-only runs and does not launch `MESHDROP_ANDROID_AVD`.
4. Confirm the smoke prints `Proof android-physical-device-uat`.
5. Confirm the proof names the hardware manufacturer/model, Android release/API level, CPU ABI, selected serial, and
   the install, WebView capability, WebView transfer, share-intent transfer, and native picker UI smoke scripts.
6. Latest proof: this command passed on Google Pixel 7 Pro `28031FDH300BS5` and printed
   `Proof android-physical-device-uat`.

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
npm run build:ios:simulator-app -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:ios:device-app -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android:apk -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android:release-apk -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
node --test test/mobile-package.test.js
npm run test:ios-simulator-app
npm run test:ios-device-app
npm run test:ios-signed-device
npm run test:android-apk
npm run test:android-release-apk
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-apk-install
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-picker-ui
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-fips-pollen
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-capabilities
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-transfer
MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-share-file
npm run test:target-artifacts
npm run test:android-physical-device
```

This smoke proves source artifact shape, native-source wrapper source shape, target metadata, runtime capability metadata,
an unsigned iOS Simulator app package build, an unsigned `iphoneos` iOS device app build, an Android debug APK build,
a UAT-signed Android release APK build with `apksigner` proof, Android emulator
install/launch proof, native Android picker UI file selection, Android WebView runtime capability evidence including
Bluetooth API negotiation with transfer disabled, Android WebView-to-Chromium Nostr WebRTC transfer through a local fake
relay, Android `ACTION_SEND` file share delivery through the same WebRTC send path, and real Nostr WebRTC transfers
between two browser peers served from the generated iOS and Android source artifacts. The iOS native-source artifact
records Bluetooth as explicitly negotiated unsupported with no Web Bluetooth API and no Bluetooth native bridge
available.

## Not Proven

- The Android release APK artifact proves a release APK signed with a generated UAT keystore.
- These artifacts do not prove app-store packages, Play Store upload signing, AABs, or IPAs.
- The Android debug APK artifact alone does not prove install UAT; `npm run test:android-apk-install` provides the
  emulator install proof.
- The Android native backend can package explicit per-ABI `fips`, `fipsctl`, and `pln` tool binaries. The default smoke
  artifact still does not include Android Rust FIPS or Android pln binaries; the Android `pln` proof requires
  `MESHDROP_ANDROID_PLN_<ABI>` to point at a real Android `pln` binary.
- Android WebView transfer proof alone does not prove physical Android device install UAT; the current physical-device
  claim is backed by `npm run test:android-physical-device` passing on Google Pixel 7 Pro `28031FDH300BS5`.
- The iOS Simulator app artifact proves an unsigned Simulator `.app` package only.
- The iOS device app artifact proves an unsigned generic `iphoneos` `.app` build product only; it does not prove a
  signed device-installable IPA, App Store/TestFlight packaging, App Group provisioning, or physical-device install.
- `npm run test:ios-signed-device` is the required signed/device-install harness. It must pass on a macOS host with a
  physical iOS device before claiming signed install or App Group provisioning proof.
- These artifacts do not prove native mobile WebRTC transfer UAT on iOS devices.
- The iOS native-source wrapper wires WKWebView file inputs to a document picker through the iOS 18.4+ open-panel hook,
  and the iOS native-source artifact includes Xcode project, entitlement, share extension source scaffolds, and an App
  Group share-inbox bridge exposed as `globalThis.meshdropShareInbox`; source tests prove the web app consumes staged
  share-inbox files into share mode, but this does not prove iOS device picker UAT, App Group entitlement provisioning
  on a signed device, share-sheet device UAT, or native iOS share-initiated transfer.
- The iOS native-source artifact proves Bluetooth capability negotiation only as unsupported. It does not prove Bluetooth
  transfer support.
- These artifacts do not prove Bluetooth transport support.
