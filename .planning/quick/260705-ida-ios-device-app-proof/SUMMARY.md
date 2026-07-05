# iOS Device App Proof Summary

## Result

Added an unsigned generic `iphoneos` device app artifact path for iOS:

- `npm run build:ios:device-app`
- `npm run test:ios-device-app`
- PR CI macOS iOS lane runs the device app smoke after Xcode and Simulator app smokes.
- Release workflow builds/uploads the app product, and release readback expects it.

## Proof Added

The device app package contains:

- `MeshDrop.app/Info.plist`
- `build-proof.json`
- `UAT-MOBILE.md`

`build-proof.json` records `packageType: unsigned-device-app`, `sdk: iphoneos`, `destination:
generic/platform=iOS`, `codeSigningAllowed: false`, `deviceInstallable: false`, and `appStoreReady: false`.

## Verification

- `node --check scripts/build-ios-device-app-package.mjs`
- `node --check scripts/ios-device-app-package-smoke.mjs`
- `node --test test/ios-device-app-package.test.js test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js`
- `npm ci`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .` (baseline warnings remain outside this slice)

CI rerun evidence replaced the original archive approach: GitHub macOS `xcodebuild archive` failed twice with
`Archive Missing Bundle Identifier`, even after adding bundle metadata. The unsigned generic `iphoneos` app build is
the honest package proof until signing/provisioning work produces a device-installable IPA.

## Still Not Proven

- Signed/device-installable IPA.
- App Group entitlement provisioning.
- iOS device file-picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.
