# iOS Xcode CI Smoke Plan

## Goal

Turn the generated iOS native-source Xcode project from source-shape proof into an executable macOS CI build proof without claiming signed app output, provisioning, device picker UAT, share-sheet UAT, or native iOS transfer.

## Scope

- Add a macOS-only smoke script that builds the generated `MeshDrop` Xcode scheme for iOS Simulator with code signing disabled.
- Add a runtime-gated CI job for the smoke.
- Update runbooks and target status to remove only the Xcode build gap once CI passes.

## Verification

- `node --check scripts/ios-xcode-build-smoke.mjs`
- `node --test test/ci-workflow.test.js test/uat-runbooks.test.js`
- `npm test`
- GitHub CI `iOS Xcode native-source build smoke`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
