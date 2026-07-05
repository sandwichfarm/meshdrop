---
id: 260705-r4n
slug: ios-simulator-app-package
status: complete
created: 2026-07-05
---

# iOS Simulator App Package Proof

## Goal

Close the narrow iOS gap for an unsigned Simulator `.app` package built from the generated Xcode source, without claiming signed device packaging, App Group provisioning, picker UAT, share-sheet UAT, or native iOS transfer.

## Plan

1. Reuse the generated native-source/Xcode smoke path.
2. Add a package builder that runs `xcodebuild` for `iphonesimulator`, copies the built `MeshDrop.app`, and archives it with build-proof metadata.
3. Add a fake-Xcode unit test for Linux/local proof and a macOS CI step for real Xcode proof.
4. Update UAT docs and target ledger to name exactly what is proven and what remains open.

## Verification

- `node --check scripts/ios-xcode-smoke-helpers.mjs`
- `node --check scripts/build-ios-simulator-app-package.mjs`
- `node --check scripts/ios-simulator-app-package-smoke.mjs`
- `node --check scripts/ios-xcode-build-smoke.mjs`
- `node --test test/ios-simulator-app-package.test.js test/mobile-package.test.js test/ci-workflow.test.js test/uat-runbooks.test.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
