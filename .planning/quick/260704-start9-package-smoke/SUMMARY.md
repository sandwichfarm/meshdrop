---
status: complete
completed: 2026-07-04
slug: start9-package-smoke
---

# Summary: Start9 Package Smoke

## Result

Added `npm run test:start9-package` to build the Start9-target image, build and unpack the generated Start9 package
source artifact, read the generated StartOS environment, run the target image locally with that environment, verify
`/config` reports `capabilities.runtime.target` as `start9`, and initiate browser transfers over local WebRTC and
Pollen WebRTC.

## Evidence

- Red test: `node --test test/start9-package.test.js` failed before `test:start9-package` existed.
- Focused tests: `node --test test/start9-package.test.js test/uat-runbooks.test.js` passed: 4/4.
- Runtime smoke: `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:start9-package` passed with `Proof docker-local-webrtc`, `Proof docker-pollen-webrtc`, and `Proof start9-package-local-webrtc`.
- Repo tests: `npm test` passed: 178/178.
- Whitespace: `git diff --check` passed.
- Changed-code slop: `npx --yes aislop scan --changes .` passed for tracked changed JS.
- Full-repo slop: `npx --yes aislop scan .` remains on the existing baseline: 461 `no-undef` errors, 3 `innerHTML` security errors in `public/scripts/ui.js`, large files, duplicate blocks, console warnings, and style warnings.

## Remaining Gaps

- Not proven on a real StartOS device installed through the StartOS UI.
- FIPS remains disabled by default for Start9 until target-specific FIPS binary and device-network UAT exists.
