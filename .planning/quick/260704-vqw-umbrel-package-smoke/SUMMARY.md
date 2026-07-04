---
status: complete
completed: 2026-07-04
slug: umbrel-package-smoke
---

# Summary: Umbrel Package Smoke

## Result

Added `npm run test:umbrel-package` to build the local Umbrel-target image, build and unpack the generated Umbrel package,
run the rendered package `docker-compose.yml`, verify `/config` reports `capabilities.runtime.target` as `umbrel`, and
initiate browser transfers over local WebRTC and Pollen WebRTC.

## Evidence

- Red test: `node --test test/umbrel-package.test.js` failed before `scripts/umbrel-package-smoke.mjs` existed.
- Focused tests: `node --test test/runtime-capabilities.test.js test/server-admin-settings.test.js test/umbrel-package.test.js test/uat-runbooks.test.js` passed: 11/11.
- Runtime smoke: `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:umbrel-package` passed with `Proof docker-local-webrtc`, `Proof docker-pollen-webrtc`, and `Proof umbrel-package-local-webrtc`.
- Repo tests: `npm test` passed: 177/177.
- Whitespace: `git diff --check` passed.
- Changed-code slop: `npx --yes aislop scan --changes .` passed after narrowing the server runtime-target change.
- Full-repo slop: `npx --yes aislop scan .` remains on the existing baseline: 461 `no-undef` errors, 3 `innerHTML` security errors in `public/scripts/ui.js`, large files, duplicate blocks, console warnings, and style warnings.

## Remaining Gaps

- Not proven on a real Umbrel node installed through the Umbrel UI.
- FIPS remains disabled by default for Umbrel until target-specific FIPS binary and device-network UAT exists.
