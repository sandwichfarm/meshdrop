# Summary

## Change

- Added a regression for caller-side RTC data channel reconnect.
- Changed caller channel-close recovery to drop the existing `RTCPeerConnection` before reconnecting.
- This avoids creating a new offer against a stable, already-negotiated connection after a transfer path closes the data channel.

## Evidence

- Red proof: `node --test test/rtc-peer-signaling.test.js` failed before the fix because the reconnect reused one connection (`1 !== 2`).
- `node --test test/rtc-peer-signaling.test.js` passed: 16/16.
- First `npm run test:e2e` attempt failed before runtime because fresh worktree dependencies were not installed: missing `ws`.
- `npm ci` passed with 0 vulnerabilities.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed and proved local WebRTC, Blossom, Hashtree, FIPS WebRTC, Pollen WebRTC, Pollen storage, Nostr WebRTC, and federated FIPS WebRTC transfers.
- `npm test` passed: 154/154.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact` passed.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors and existing touched-file warnings in `public/scripts/network.js`.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors, 3 direct `innerHTML` security findings in `public/scripts/ui.js`, console/trivial-comment warnings, duplicate-code warnings, and file-size warnings.

## Known Gaps

- Not live-tested against public relays or two separately deployed hosts.
