# Phase 21 Note: Pending Route Display Name Crash

Status: phase still in progress.

## Delivered

- Display-name restore now skips pending private-route placeholder peers that cannot send signaling messages yet.
- Added a regression for the clearnet-disabled path where a Nostr peer becomes a pending FIPS route request before any WebRTC peer exists.

## Evidence

- Red proof before fix: `node --test test/rtc-peer-signaling.test.js` failed with `peer.sendDisplayName is not a function`.
- Focused proof after fix: `node --test test/rtc-peer-signaling.test.js` -> 38/38 pass.
- Full proof after deps install: `npm test` -> 385/385 pass.
- Gate proof: `git diff --check` clean.
- Changed-code scan: `npx --yes aislop scan --changes .` -> 0 AI-slop issues; existing size/duplicate warnings remain in `public/scripts/network.js`.

## Remaining Risk

- This removes the console crash. It does not by itself prove live two-device FIPS/Pollen byte transfer.
