# 20260704 Federated FIPS Offer Recovery Plan

## Goal

Restore the master `Browser transfer smoke` after manual run `28713488687` failed in `federated-fips-webrtc` with a
stale local-offer m-line `InvalidAccessError`.

## Scope

- Patch RTC signaling to recover once from stale local-offer m-line errors by dropping the negotiated connection and
  opening a fresh offer.
- Add focused unit coverage for one-shot recovery and no infinite retry.
- Verify the full browser e2e smoke still initiates and completes the federated FIPS WebRTC transfer.
- Keep the public relay UAT evidence recorded separately; this task is about the unrelated master red check.

## Validation

- `node --test test/rtc-peer-signaling.test.js`
- `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`
- `npm test`
- `git diff --check`
- Changed-code slop scan
- PR CI / master CI readback
