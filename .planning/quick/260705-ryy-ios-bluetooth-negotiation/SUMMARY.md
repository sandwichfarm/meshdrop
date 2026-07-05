---
status: complete
quick_id: 260705-ryy
slug: ios-bluetooth-negotiation
date: 2026-07-05
---

# Summary

iOS native-source artifacts now include explicit Bluetooth capability metadata that negotiates the path as unsupported:
`supported=false`, `transferSupported=false`, `apiAvailable=false`, and `nativeBridgeAvailable=false`.

The iOS native-source and Simulator app proof lists no longer treat Bluetooth negotiation as open, while docs still
state that Bluetooth transfer support is not proven.

# Evidence

- `node --check scripts/build-mobile-package.mjs`
- `node --check scripts/build-ios-simulator-app-package.mjs`
- `node --check scripts/ios-simulator-app-package-smoke.mjs`
- `node --test test/mobile-package.test.js test/ios-simulator-app-package.test.js test/uat-runbooks.test.js` passed 8/8.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed 204/204.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed on 3 changed code files.
- `npx --yes aislop scan .` ran and reported the known full-repo baseline: 57 warnings outside this slice.

# Known Gaps

- This does not prove Bluetooth transfer support.
- This does not prove signed/device-installable iOS packages, App Group provisioning, iOS device picker UAT,
  share-sheet device UAT, or native iOS transfer UAT.
