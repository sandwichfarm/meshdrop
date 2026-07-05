# iOS Xcode CI Smoke Summary

## Result

The CI workflow now has a macOS job that generates the iOS native-source artifact and runs `xcodebuild` against the generated `MeshDrop` scheme for iOS Simulator with code signing disabled.

## Verification

- `node --check scripts/ios-xcode-build-smoke.mjs` -> pass.
- `PATH=<fake-xcodebuild> npm run test:ios-xcode-build` -> pass; proves package extraction reaches the generated native-source project path and invokes the `MeshDrop` scheme with signing disabled.
- `node --test test/mobile-package.test.js test/ci-workflow.test.js test/uat-runbooks.test.js` -> 15/15 pass.
- `npm test` -> 202/202 pass.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> clean run, 0 issues.
- `npx --yes aislop scan .` -> baseline failing with 57 warnings outside this slice.
- Local `xcodebuild` -> unavailable in this Linux worktree; macOS proof must come from CI.
- First CI attempt failed before Xcode because macOS BSD tar does not support GNU `--sort=name`.
- Repair: `test:ios-xcode-build` now builds the native-source package and requests portable tar metadata for its temporary smoke artifact.
- Second CI attempt reached Swift compilation and failed in the app target; generated Swift now emits the embedded target manifest as a valid newline-delimited raw multiline string.
- Changed-code AI-slop scan initially flagged the touched mobile source generator's pre-existing long Android source builder; the Android generator was split into smaller chunks and changed-code scan is clean.
- Pending before next CI run: GitHub job `iOS Xcode native-source build smoke`.

## Not Proven

- Signed native iOS app package output.
- Apple developer team App Group entitlement provisioning.
- iOS device file-picker UAT.
- iOS share-sheet device UAT.
- Native iOS WebRTC transfer UAT.
