# Browser CI Bidirectional Readiness Fix

## Status

Complete

## Failure

Post-merge `master` CI run `28705384333` failed in the browser transfer smoke job after #8 merged.
The first `local-webrtc` transfer timed out waiting for received files.

## Cause Hypothesis

The generic proof waited for the sender page to report a connected peer, but did not require the receiver page to report
its reciprocal connection before sending the proof file. GitHub-hosted Chromium can expose that sender/receiver readiness
race more often than the local runner.

## Scope

- Wait for a connected peer on both sender and receiver before sending in generic transfer proof scenarios.
- Include receiver debug state when file receipt times out.
- Keep the actual transfer proof intact.

## Validation

- `npm ci`
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
- `npx --yes aislop scan --changes .` exited 0 with 0 errors and existing touched-file size/function warnings.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline.
