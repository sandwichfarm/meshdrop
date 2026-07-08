# Phase 21 Note: Dynamic Federation Rooms

Status: phase still in progress.

## Delivered

- Server federation now tracks FIPS/Pollen rooms joined by connected browser clients.
- Active client WOT rooms drive Nostr federation subscription filters and FIPS/Pollen announcements without requiring public discovery env.
- Relay announcements in an active client WOT room are accepted even when the announcing author is not in static server env config.
- Leaving the last local peer in a client WOT room removes that room from server-side acceptance and relay subscription refresh.
- Existing trusted-recipient and explicit public discovery behavior remains covered.

## Evidence

- Red proof before fix: `node --test test/federation-server.test.js` failed 3 new dynamic-room regressions.
- Focused proof after fix: `node --test test/federation-server.test.js` -> 33/33 pass.
- Broad proof: `npm test` -> 384/384 pass.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean, 100/100.

## Remaining Risk

- This slice fixes server-side dynamic discovery/advertisement. It does not implement a FIPS/Pollen ICE bridge daemon.
- Browser byte transport over FIPS/Pollen still requires a route-scoped ICE bridge descriptor when direct WebRTC/Clearnet is unavailable.
