# Docker Transfer Timeout Fix Summary

## Changed

- `scripts/docker-browser-transfer-smoke.mjs` now passes `undefined, {timeout: 45000}` to the receive-side
  `page.waitForFunction` call, so Playwright honors the intended 45 second wait.
- Docker browser-transfer failures now include the route name and receiver page state.
- `test/docker-smoke-script.test.js` guards the corrected timeout call shape.

## Verification

- `node --test test/docker-smoke-script.test.js` passed.
- `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker` passed and proved Docker local WebRTC plus Pollen
  mesh transfers.
- `npm test` passed 165/165.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed 100/100 with no issues.
- PR #30 merged at `c507330`.
- Master CI run `28713014340` passed all jobs on merge commit `c507330`.

## Cause

Master CI run `28712847718` failed Docker smoke because the receive wait passed the timeout object as the Playwright
page argument. That made Playwright use the default 30 second timeout instead of the intended 45 second timeout.
