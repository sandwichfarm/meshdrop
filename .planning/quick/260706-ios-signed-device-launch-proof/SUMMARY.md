# iOS Signed Device Launch Proof Summary

## Result

The signed iOS device UAT harness now installs and launches the signed app through `devicectl` before printing proof.

## Changed

- Added explicit `devicectl` install and launch argument builders.
- Updated `npm run test:ios-signed-device` to launch `farm.sandwich.meshdrop` after install.
- Updated the mobile UAT runbook and target-status ledger to say install-and-launch harness without claiming a real macOS/device pass.
- Extended focused tests and runbook guards.

## Evidence

- `node --test test/ios-signed-device-uat.test.js test/uat-runbooks.test.js` passed 5/5.
- `npm run test:ios-signed-device` on Linux failed loud with `Not proven: signed iOS device UAT requires macOS with Xcode.`
- `npm test` passed 229/229 after installing dependencies in the fresh task worktree.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed.
- `npx --yes aislop scan .` ran and reported the known full-repo baseline warnings.

## Remaining

- A real signed iOS pass still requires macOS, Xcode, a development team, provisioning, and a physical device.
- Device file-picker UAT, share-sheet device UAT, native mobile transfer UAT, Start9/Umbrel deployed-node UAT, and anonymous GHCR public readback remain open.
