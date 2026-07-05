# iOS Share Extension Source Plan

## Goal

Add iOS share-sheet source wiring to the native-source artifact without claiming device UAT or native iOS transfer proof.

## Scope

- Generate a `MeshDropShareExtension` source scaffold in the iOS native-source artifact.
- Stage shared files through an App Group container so the containing app has a defined handoff point.
- Document that App Group entitlement setup, device share-sheet UAT, and native iOS WebRTC transfer remain unproven.
- Add source-shape tests for generated files and UAT ledger wording.

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js`
- `node --check scripts/mobile-native-source.mjs`
- iOS native-source archive readback for share extension files and plist keys.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

