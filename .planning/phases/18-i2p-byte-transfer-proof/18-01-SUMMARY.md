# Phase 18 Summary: I2P Byte Transfer Proof

## Result

Complete. MeshDrop now has a reproducible I2P overlay stream proof that transfers bytes through a Dockerized i2pd `.b32.i2p` route and emits route proof without claiming WebRTC or Clearnet fallback.

## Delivered

- Added `npm run test:i2p-stream` with a Dockerized i2pd HTTP proxy/server tunnel path.
- Reused the generic overlay stream upload/download endpoints for I2P.
- Added route-proof and smoke-script tests for I2P stream behavior.
- Added ADR 0010 documenting the I2P proof boundary.

## Evidence

- `node --test test/overlay-stream-transfer.test.js test/overlay-network-adapters.test.js test/route-contract.test.js test/runtime-capabilities.test.js test/docker-smoke-script.test.js test/route-blocker-issues.test.js` -> 33/33 pass.
- `npm run test:i2p-stream` -> `Proof i2p-http-stream` with a generated `.b32.i2p` endpoint, 42/42 bytes, hash matched, fallback disabled.
- `npm test` -> 369/369 pass.

## Remaining Risk

- This proves I2P `i2p-http-stream`, not I2P WebRTC.
- The smoke uses local zero-hop i2pd tunnels for deterministic proof; public I2P reachability remains a separate UAT surface.
- Loki remains blocked until equivalent daemon/proxy runtime proof exists.
