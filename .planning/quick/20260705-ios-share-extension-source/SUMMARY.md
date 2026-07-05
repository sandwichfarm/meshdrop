# iOS Share Extension Source Summary

## Result

The iOS native-source artifact now includes a source-only share extension scaffold:

- `native/ios/MeshDropShareExtension/ShareViewController.swift`
- `native/ios/MeshDropShareExtension/Info.plist`
- `native/ios/MeshDrop/MeshDropShareInbox.swift`

The extension declares `com.apple.share-services`, accepts file shares through `NSExtensionActivationRule`, and stages copied files plus `share-inbox.json` into an App Group container. The containing app source has a matching inbox reader.

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js` -> 6/6 pass.
- `node --check scripts/mobile-native-source.mjs` -> pass.
- `npm run build:ios:native-source -- --version 0.0.0-proof --out-dir <tmp>` plus tar readback -> share extension files and plist keys present.
- `npm test` -> 200/200 pass.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> 0 errors; one pre-existing `androidActivitySource` length warning remains in the changed file.
- `npx --yes aislop scan .` -> baseline failing with 58 warnings outside this slice.

## Not Proven

- Xcode project integration.
- App Group entitlement provisioning.
- iOS device picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.

