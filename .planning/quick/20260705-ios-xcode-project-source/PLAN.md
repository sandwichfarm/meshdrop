# iOS Xcode Project Source Plan

## Goal

Move iOS from loose Swift source files toward a buildable native-source package by generating an Xcode project scaffold without claiming macOS build, signing, entitlement provisioning, device UAT, or native iOS transfer proof.

## Scope

- Add deterministic `MeshDrop.xcodeproj` and shared scheme files to the iOS native-source artifact.
- Add App Group entitlement files for the containing app and share extension.
- Wire tests and docs to prove source artifact shape while preserving remaining UAT gaps.

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js`
- `node --check scripts/mobile-native-source.mjs`
- `npm run build:ios:native-source -- --version 0.0.0-proof --out-dir <tmp>` with tar readback.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

