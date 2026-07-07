# Phase 17 Summary: Tor Byte Transfer Proof

## Result

Complete. MeshDrop now has a reproducible Tor overlay stream proof that transfers bytes through a Dockerized `.onion` route and emits route proof without claiming WebRTC or Clearnet fallback.

## Delivered

- Added `server/overlay-stream-transfer.js` for token-bound, short-lived overlay stream uploads/downloads.
- Wired `/overlay/:route/status`, `/overlay/:route/upload`, and `/overlay/:route/download/:id` into the backend.
- Added `npm run test:tor-stream` with a Dockerized Tor hidden service and SOCKS fetch path.
- Added route-proof and endpoint tests for Tor stream behavior.
- Added ADR 0009 documenting the Tor proof boundary.

## Evidence

- `node --test test/overlay-stream-transfer.test.js test/overlay-network-adapters.test.js test/route-contract.test.js test/runtime-capabilities.test.js test/docker-smoke-script.test.js` -> 31/31 pass.
- `npm run test:tor-stream` -> `Proof tor-http-stream` with a generated `.onion` endpoint, 42/42 bytes, hash matched, fallback disabled.
- `npm test` -> 368/368 pass.
- `git diff --check` -> pass.

## Remaining Risk

- This proves Tor `tor-http-stream`, not Tor WebRTC.
- I2P and Loki remain blocked until equivalent daemon/proxy runtime proof exists.
