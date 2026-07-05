# WebSocket Server Log Baseline Summary

## Changed

- Added an explicit stderr writer in `server/ws-server.js`.
- Replaced socket error and malformed-message `console.*` output with explicit stderr writes.
- Preserved malformed-message early return, signaling relay behavior, and WebSocket fallback warning behavior.

## Verification

- `node --check server/ws-server.js` -> passed.
- `node --test test/ws-room.test.js test/federation-server.test.js test/rtc-peer-signaling.test.js` -> 38 passed after `npm install`.
- `npm test` -> 200 passed.
- `git diff --check` -> passed.
- `npx --yes aislop scan --changes .` -> exit 0, 0 errors, 1 pre-existing file-size warning in touched legacy `server/ws-server.js`.
- `npx --yes aislop scan .` -> exit 1, 0 errors, 58 warnings.

## Remaining Baseline

- Full-repo `aislop` still reports vendored noble-ciphers unused expressions, large files, duplicate blocks, one hardcoded URL, TODO/stub warnings, long functions, and one unused parameter in `public/scripts/network.js`.
- Server-side console matches remain in federation warning paths only.
