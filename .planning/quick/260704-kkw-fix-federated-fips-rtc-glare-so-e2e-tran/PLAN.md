---
status: complete
created: 2026-07-04T12:49:05.230Z
---

# Fix Federated FIPS RTC Glare

## Goal

Remove the late-answer `InvalidStateError` console noise observed during federated FIPS WebRTC proof while preserving real file-transfer proof.

## Scope

- Inspect current RTC signaling state guards around local answer creation.
- Reproduce the federated FIPS e2e behavior in the fresh task worktree.
- Add focused regression coverage for the async stale-answer path.
- Patch the narrow RTC signaling behavior only.
- Verify with focused RTC tests, broad tests, e2e transfer proof, Docker smoke, diff check, and AI-slop scans.

## Out Of Scope

- Broader transport redesign.
- Start9/Umbrel/native/mobile packaging.
- Full repo slop baseline cleanup.

## Validation

- `node --test test/rtc-peer-signaling.test.js`
- `npm test`
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
