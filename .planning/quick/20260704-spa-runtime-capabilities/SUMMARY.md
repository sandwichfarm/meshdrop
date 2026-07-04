---
status: complete
completed: 2026-07-04
branch: agent/spa-runtime-capabilities-20260704
---

# SPA Runtime Capabilities Summary

## Completed

- Added a static SPA runtime capability config for hosts that cannot serve `/config`.
- Kept no-backend SPA runtime truthful: WebRTC/Nostr/Blossom/Hashtree remain available, while local discovery, FIPS, Pollen, and signed backend settings are unavailable.
- Made static-host `config` responses that return 404, network error, or fallback HTML resolve to SPA config instead of blocking startup.
- Hid backend-only controls under no-backend runtime config, including local discovery, FIPS discovery, Pollen transfer, and the FIPS admin settings tab.
- Preserved server-backed runtime behavior and transfer proof.

## Evidence

- Focused tests failed before implementation on no-backend capabilities and static config fallback.
- `npm ci` passed with 0 vulnerabilities.
- `node --test test/admin-settings-protocol.test.js test/runtime-capabilities.test.js test/action-visibility.test.js test/spa-runtime-config.test.js` passed: 26/26.
- `npm test` passed: 150/150.
- Static browser proof passed: no WebSocket opened; local/FIPS/Pollen controls hidden; FIPS admin tab hidden; no page errors.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed and proved local WebRTC, FIPS WebRTC, Pollen WebRTC, Pollen storage, Nostr WebRTC, Blossom, Hashtree, and federated FIPS WebRTC transfers.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors and 9 warnings from existing `network.js` size/duplicate/unused baseline.
- `npx --yes aislop scan .` exited 1 on existing repo-wide baseline: 461 no-undef browser globals, 3 `public/scripts/ui.js` innerHTML security findings, console/trivial-comment warnings, file size, and duplicate-code warnings.

## Risks

- Browser e2e still logs a non-fatal federated-FIPS sender `InvalidStateError` while the transfer succeeds; this should be a follow-up TRNS regression item, not hidden by this runtime slice.
- Static SPA now has a truthful capability fallback, but no packaged SPA release artifact or UAT runbook has been added yet.
