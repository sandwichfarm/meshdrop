# iOS Device Archive Proof Summary

## Result

Added an unsigned generic `iphoneos` device archive artifact path for iOS:

- `npm run build:ios:device-archive`
- `npm run test:ios-device-archive`
- PR CI macOS iOS lane runs the archive smoke after Xcode and Simulator app smokes.
- Release workflow builds/uploads the archive, and release readback expects it.

## Proof Added

The archive package contains:

- `MeshDrop.xcarchive/Info.plist`
- `MeshDrop.xcarchive/Products/Applications/MeshDrop.app/Info.plist`
- `build-proof.json`
- `UAT-MOBILE.md`

`build-proof.json` records `packageType: unsigned-device-archive`, `sdk: iphoneos`, `destination:
generic/platform=iOS`, `codeSigningAllowed: false`, `deviceInstallable: false`, and `appStoreReady: false`.

## Verification

- `node --check scripts/build-ios-device-archive-package.mjs`
- `node --check scripts/ios-device-archive-package-smoke.mjs`
- `node --test test/ios-device-archive-package.test.js test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js`
- `npm ci`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .` (baseline warnings remain outside this slice)

## Still Not Proven

- Signed/device-installable IPA.
- App Group entitlement provisioning.
- iOS device file-picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.
