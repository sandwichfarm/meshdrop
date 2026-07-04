---
status: complete
completed: 2026-07-04
slug: bluetooth-capability-gate
---

# Summary

Added an explicit Bluetooth capability gate across server and static runtime config. MeshDrop now reports Bluetooth as
unsupported until a real Bluetooth transport exists and is transfer-tested.

## Changed

- Added `transports.bluetooth.supported === false` to server `/config` capabilities.
- Added static runtime Bluetooth capability metadata for SPA, desktop, and mobile artifacts.
- Added `bluetooth: false` to the desktop target manifest.
- Updated the desktop UAT runbook to require Bluetooth to remain false until implemented and tested.

## Evidence

- Red proof: focused capability tests failed before implementation because `transports.bluetooth` was missing.
- `node --test test/runtime-capabilities.test.js test/spa-runtime-config.test.js test/desktop-package.test.js test/mobile-package.test.js test/uat-runbooks.test.js` passed: 14/14.
- `npm ci` completed from lockfile: 87 packages, 0 vulnerabilities.
- `npm test` passed: 179/179.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still fails on the known repo baseline: 461 no-undef lint errors, 3 `innerHTML`
  security errors, and style/complexity warnings.

## Remaining Risk

- No Bluetooth transfer protocol exists.
- No physical-device Bluetooth UAT was run.
