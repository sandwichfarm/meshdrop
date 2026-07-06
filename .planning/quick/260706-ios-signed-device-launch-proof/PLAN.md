# iOS Signed Device Launch Proof

## Goal

Strengthen the signed iOS device UAT harness so a passing run proves the signed app is not only installed on the physical device, but also launched through `devicectl`.

## Scope

- Extend `scripts/ios-signed-device-uat.mjs` to run `xcrun devicectl device process launch`.
- Add focused unit coverage for the install and launch command arguments.
- Update UAT runbook/status wording without claiming an actual macOS/device pass.

## Verification

- `node --test test/ios-signed-device-uat.test.js test/uat-runbooks.test.js`
- `npm test`
- `npm run test:ios-signed-device` on this Linux host must fail loud with macOS/Xcode not proven.
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
