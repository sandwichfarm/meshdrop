# WebSocket Server Log Baseline

## Goal

Reduce remaining WebSocket server console warnings without changing signaling or fallback behavior.

## Scope

- Replace `server/ws-server.js` socket error and malformed-message `console.*` output with explicit stderr writes.
- Preserve malformed-message early return and WebSocket fallback warning behavior.
- Leave federation warning paths for a separate PR.

## Verification

- `node --check server/ws-server.js`
- Focused WebSocket room tests.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
