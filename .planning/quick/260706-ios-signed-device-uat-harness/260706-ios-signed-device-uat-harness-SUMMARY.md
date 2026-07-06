---
status: complete
quick_id: 260706-ios
slug: ios-signed-device-uat-harness
date: 2026-07-06
completed_at: 2026-07-06
---

# Quick Task 260706-ios: iOS Signed Device UAT Harness

## Summary

- Added `npm run test:ios-signed-device` as the signed iOS device-install proof command.
- The harness rejects non-macOS runs and requires `MESHDROP_IOS_DEVELOPMENT_TEAM` plus
  `MESHDROP_IOS_DEVICE_UDID` before building.
- On macOS, the harness builds the generated `MeshDrop.xcodeproj` for the requested physical device with signing
  enabled, inspects App Group entitlements on the app and share extension, and installs through `devicectl`.
- UAT docs and target status now name the exact command and keep file-picker, share-sheet, native transfer, App Store,
  and TestFlight proof open.

## Verification

- `node --test test/ios-signed-device-uat.test.js test/uat-runbooks.test.js` passed 4/4.
- `npm test` passed 228/228.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran and reported the known full-repo baseline warnings outside changed code.
- `npm run test:ios-signed-device` failed loud on this Linux host with
  `Not proven: signed iOS device UAT requires macOS with Xcode.`

## Remaining Gaps

- `npm run test:ios-signed-device` has not passed on this Linux host because macOS/Xcode/device/signing are required.
- iOS device file-picker UAT, share-sheet UAT, and native mobile transfer UAT remain open after signed install proof.
