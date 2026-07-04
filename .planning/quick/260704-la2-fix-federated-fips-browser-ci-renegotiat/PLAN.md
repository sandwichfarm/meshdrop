# Fix federated FIPS browser CI renegotiation

## Problem

Master CI run `28707353844` failed in `Browser transfer smoke` after the real transfer proofs passed. The failing path was
`federated-fips`, where the sender logged:

```text
InvalidAccessError: Failed to execute 'setLocalDescription' on 'RTCPeerConnection': Failed to set local offer sdp: The order of m-lines in subsequent offer doesn't match order from previous offer/answer.
```

## Scope

- Keep the fix limited to RTC reconnect behavior after a data channel closes.
- Preserve the browser e2e assertion that page console errors fail the proof.
- Add a regression that prevents caller reconnect from renegotiating on the old peer connection.

## Verification Plan

- Red regression: `node --test test/rtc-peer-signaling.test.js`.
- Focused unit proof after fix: `node --test test/rtc-peer-signaling.test.js`.
- Runtime proof: `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.
- Broad gates: `npm test`, `npm run test:spa-artifact`, `npm run test:docker`, `git diff --check`.
- Quality gates: `npx --yes aislop scan --changes .`, `npx --yes aislop scan .`.
