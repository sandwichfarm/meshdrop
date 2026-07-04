---
status: complete
quick_id: 260705-mns
slug: mobile-native-shell-source-artifacts
---

# Quick Task 260705-mns: Mobile Native Shell Source Artifacts

## Goal

Move the iOS and Android targets beyond generic source bundles by producing deterministic native-shell source artifacts
that package the MeshDrop web runtime with platform wrapper source, without claiming installable app packages or native
mobile transfer UAT.

## Scope

1. Extend the mobile artifact builder to emit native-source artifacts for iOS and Android.
2. Include platform wrapper source that loads the packaged MeshDrop runtime and injects target metadata.
3. Add package metadata that keeps unsupported backend, Bluetooth, and native transfer claims disabled.
4. Wire the new artifacts into release creation.
5. Update UAT docs and guards so target status distinguishes source bundles, native-source artifacts, and still-open app
   package/device transfer proof.

## Out Of Scope

- Building APK or IPA packages on this Linux host.
- Adding Android SDK, Xcode, Capacitor, Tauri, or other new dependencies.
- Claiming native mobile WebRTC transfer, file-picker/share-sheet, or Bluetooth support.

## Validation

- `node --test test/mobile-package.test.js`
- `node --test test/release-workflow.test.js test/uat-runbooks.test.js`
- `npm run build:ios:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-native-smoke`
- `npm run build:android:native-source -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-native-smoke`
- `npm test`
- `git diff --check`
