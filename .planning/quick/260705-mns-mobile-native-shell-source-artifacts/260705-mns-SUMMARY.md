---
status: complete
quick_id: 260705-mns
slug: mobile-native-shell-source-artifacts
completed: 2026-07-05
---

# Summary

MeshDrop now emits deterministic iOS and Android native-source artifacts in addition to the existing browser-backed
mobile source bundles.

The new artifacts package the app assets with native wrapper source:

- iOS: SwiftUI/WKWebView source under `native/ios/MeshDrop/`.
- Android: Android WebView project source under `native/android/`.

Both native-source manifests set `nativeShellSourceBuilt: true`, keep `nativeShellBuilt: false`, and gate WebRTC/Nostr
off until a real APK/IPA build and native mobile transfer UAT prove those paths.

## Evidence

- `node --test test/mobile-package.test.js`
- `node --test test/release-workflow.test.js test/uat-runbooks.test.js`
- `npm run build:ios:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-native-smoke`
- `npm run build:android:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-native-smoke`
- Tar readback for iOS `MeshDropViewController.swift` and bundled `Resources/meshdrop/index.html`.
- Tar readback for Android `AndroidManifest.xml`, `MainActivity.java`, and bundled `assets/meshdrop/index.html`.
- `npm test`
- `npm run test:target-artifacts`
- `git diff --check`
- `npx --yes aislop scan --changes .`

## Remaining Risk

- Native mobile APK/IPA builds are not proven on this Linux host.
- Native mobile WebRTC transfer UAT remains open.
- Mobile file-picker/share-sheet and Bluetooth negotiation remain open.
