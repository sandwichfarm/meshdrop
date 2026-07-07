# Roadmap: MeshDrop v0.14.0 I2P Byte Transfer Proof

## Phase 18: I2P Byte Transfer Proof

Goal: prove a real I2P overlay stream data path by transferring bytes through a Dockerized i2pd `.b32.i2p` endpoint and emitting route proof.

Current status: complete.

Requirements: I2P-BYTE-01, I2P-BYTE-02, I2P-BYTE-03, I2P-BYTE-04, I2P-BYTE-05.

Success criteria:

1. Generic overlay stream upload/download endpoints continue serving short-lived I2P payloads without route-specific storage.
2. I2P stream descriptors validate `.b32.i2p` endpoints and preserve private/encrypted/fail-closed route constraints.
3. `npm run test:i2p-stream` starts i2pd in Docker, publishes a MeshDrop HTTP server tunnel, downloads the payload through the i2pd HTTP proxy, and proves the hash and byte counts.
4. The emitted route proof has `routeType=i2p`, `dataPlanePrimitive=i2p-http-stream`, `webRtcUsed=false`, `fallbackUsed=false`, and topology evidence naming the `.b32.i2p` endpoint.
5. Loki remains fail-closed and issue #151 stays open for its future proof.

Verification:

- Focused: route contract, runtime capability, Docker smoke script, and overlay stream transfer unit tests.
- Runtime: `npm run test:i2p-stream`.
- Broad: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- Red guard: `node --test test/docker-smoke-script.test.js test/route-contract.test.js test/route-blocker-issues.test.js` failed until `test:i2p-stream` and `scripts/i2p-stream-smoke.mjs` existed.
- `node --test test/overlay-stream-transfer.test.js test/overlay-network-adapters.test.js test/route-contract.test.js test/runtime-capabilities.test.js test/docker-smoke-script.test.js test/route-blocker-issues.test.js` -> 33/33 pass.
- `npm run test:i2p-stream` -> `Proof i2p-http-stream` with a generated `.b32.i2p` endpoint, `i2p-http-stream`, 42/42 bytes, hash matched, and fallback disabled.
- `npm test` -> 369/369 pass.

## Future Milestone Queue

1. Loki byte-transfer proof with real local daemon/proxy dial evidence. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/151.
2. FIPS/Pollen route-specific WebRTC relay proof using the generic TURN proof harness once a relay endpoint is reachable through those overlays. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/152.
3. GHCR anonymous release image readback once package visibility or authenticated distribution policy is decided. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/156.
4. Deployed StartOS/Umbrel UAT once real installed service URLs are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/157.
5. Signed iOS device/share-transfer UAT once macOS signing hardware and a real device are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/158.

---
*Roadmap updated: 2026-07-08 completing Phase 18 I2P Byte Transfer Proof.*
