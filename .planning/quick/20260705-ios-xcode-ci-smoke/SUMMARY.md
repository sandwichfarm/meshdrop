# iOS Xcode CI Smoke Summary

## Result

The CI workflow now has a macOS job that generates the iOS native-source artifact and runs `xcodebuild` against the generated `MeshDrop` scheme for iOS Simulator with code signing disabled.

## Verification

- `node --check scripts/ios-xcode-build-smoke.mjs` -> pass.
- `node --test test/ci-workflow.test.js test/uat-runbooks.test.js` -> 10/10 pass.
- `npm test` -> 202/202 pass.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> clean run, 0 issues.
- `npx --yes aislop scan .` -> baseline failing with 58 warnings outside this slice.
- Local `xcodebuild` -> unavailable in this Linux worktree; macOS proof must come from CI.
- Pending before first CI run: GitHub job `iOS Xcode native-source build smoke`.

## Not Proven

- Signed native iOS app package output.
- Apple developer team App Group entitlement provisioning.
- iOS device file-picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.
