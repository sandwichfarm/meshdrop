---
id: 260705-r4n
slug: ios-simulator-app-package
status: complete
completed: 2026-07-05
---

# Summary

Added an unsigned iOS Simulator app package path. The new builder generates the iOS native-source artifact, runs the `MeshDrop` Xcode scheme for `iphonesimulator` with code signing disabled, copies the resulting `MeshDrop.app`, and writes a `meshdrop-ios-simulator-app-<version>.tar.gz` archive with `build-proof.json`.

## Evidence

- Focused fake-Xcode/unit proof passed: `node --test test/ios-simulator-app-package.test.js test/mobile-package.test.js test/ci-workflow.test.js test/uat-runbooks.test.js`
- Full repo tests passed after `npm ci`: `npm test` -> 204/204.
- Diff whitespace check passed: `git diff --check`.
- Changed-code AI-slop gate passed: `npx --yes aislop scan --staged .`.
- Full-repo AI-slop scan ran and still shows the known baseline: 57 warnings outside this slice.

## Remaining Gaps

- Signed/device-installable iOS package.
- App Group entitlement provisioning.
- iOS device file-picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.
- Bluetooth transport support.
