# iOS Device App Proof

## Goal

Advance the iOS target toward the signed/device package gap by adding a deterministic unsigned generic `iphoneos`
app build artifact and release/CI readback wiring.

## Scope

- Add an iOS device app builder that packages `MeshDrop.app` from generated native-source Xcode output.
- Add a smoke/test path that proves the app product shape and metadata without requiring signing credentials.
- Run the smoke from the existing macOS iOS CI lane.
- Publish and verify the app product as a release artifact.
- Update UAT ledgers to keep signed IPA, provisioning, device install, picker, share sheet, and native transfer UAT open.

## Non-goals

- Do not claim a signed or device-installable IPA.
- Do not claim App Store/TestFlight packaging.
- Do not claim App Group provisioning or physical iOS device UAT.

## Verification

- `node --check scripts/build-ios-device-app-package.mjs`
- `node --check scripts/ios-device-app-package-smoke.mjs`
- Focused tests for app builder, CI workflow, release workflow, and UAT docs.
- Full repo gates before commit.
