# Browser CI Local Disable Fix

## Status

Complete

## Failure

Post-merge `master` CI run `28705206857` failed in the browser transfer smoke job.

`disableLocalDiscovery()` timed out waiting for a stale `x-peer.type-ip` to disappear after local discovery was disabled:

- Unit tests passed.
- Docker smoke passed.
- Browser transfer smoke failed during the Pollen/FIPS disabled-local setup.

## Cause

`PeersManager` already ignores late IP peer announcements when local discovery is disabled, but `PeersUI` also listens to raw
`peers` / `peer-joined` events and could still render a late `type-ip` peer.

## Scope

- Apply the disabled-local guard at the UI peer join boundary.
- Verify the existing E2E proof that failed on GitHub.
- Keep the CI workflow unchanged unless the proof shows workflow-specific failure.

## Validation

- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Evidence

- `npm ci` passed.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed.
- `npm test` passed: 143/143.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 1 on pre-existing `public/scripts/ui.js` baseline:
  undefined globals, 3 `innerHTML` security errors, and style warnings.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline.
