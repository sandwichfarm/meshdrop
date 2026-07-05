# iOS Xcode Project Source Summary

## Result

The iOS native-source artifact now includes deterministic build scaffolding:

- `native/ios/MeshDrop.xcodeproj/project.pbxproj`
- `native/ios/MeshDrop.xcodeproj/xcshareddata/xcschemes/MeshDrop.xcscheme`
- `native/ios/MeshDrop/MeshDrop.entitlements`
- `native/ios/MeshDropShareExtension/MeshDropShareExtension.entitlements`

The project scaffold defines the containing app target and share extension target, embeds the extension, points both targets at their plist files, and references the matching App Group entitlement files.

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js` -> 6/6 pass.
- `node --check scripts/mobile-native-source.mjs` -> pass.
- `npm run build:ios:native-source -- --version 0.0.0-proof --out-dir <tmp>` plus tar readback -> Xcode project, scheme, entitlement files, app target, share extension target, and marketing version present.
- `npm test` -> 200/200 pass.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> 0 errors; one pre-existing `androidActivitySource` length warning remains in the changed file.
- `npx --yes aislop scan .` -> baseline failing with 58 warnings outside this slice.

## Not Proven

- Xcode build on macOS.
- Native iOS app package output.
- App Group entitlement provisioning in an Apple developer team.
- iOS device picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.

