# Roadmap: MeshDrop v0.15.0 Loki Byte Transfer Proof

## Phase 19: Loki Byte Transfer Proof

Goal: prove a real Loki overlay stream data path by transferring bytes through a Dockerized Lokinet `.loki` endpoint and emitting route proof.

Current status: complete.

Requirements: LOKI-BYTE-01, LOKI-BYTE-02, LOKI-BYTE-03, LOKI-BYTE-04, LOKI-BYTE-05.

Success criteria:

1. Generic overlay stream upload/download endpoints continue serving short-lived Loki payloads without route-specific storage.
2. Loki stream descriptors validate `.loki` endpoints and preserve private/encrypted/fail-closed route constraints.
3. `npm run test:loki-stream` starts Lokinet in Docker, publishes MeshDrop on the Lokinet interface, downloads the payload through plain `.loki` DNS resolution, and proves the hash and byte counts.
4. The emitted route proof has `routeType=loki`, `dataPlanePrimitive=loki-http-stream`, `webRtcUsed=false`, `fallbackUsed=false`, and topology evidence naming the `.loki` endpoint, resolver, and interface.
5. Issue #151 can close after the merged PR because Tor, I2P, and Loki all have route-specific daemon/proxy byte-transfer proof.

Verification:

- Focused: route contract, Docker smoke script, blocker issue, runtime capability, and overlay stream transfer unit tests.
- Runtime: `npm run test:loki-stream`.
- Broad: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- Red guard: `node --test test/docker-smoke-script.test.js test/route-contract.test.js test/route-blocker-issues.test.js` failed until `test:loki-stream`, `scripts/loki-stream-smoke.mjs`, and Phase 19 state existed.
- `node --test test/docker-smoke-script.test.js test/route-contract.test.js test/route-blocker-issues.test.js` -> 16/16 pass.
- `npm run test:loki-stream` -> `Proof loki-http-stream` with a generated `.loki` endpoint, `loki-http-stream`, 43/43 bytes, hash matched, and fallback disabled.
- `npm test` -> 370/370 pass.

## Future Milestone Queue

1. FIPS/Pollen route-specific WebRTC relay proof using the generic TURN proof harness once a relay endpoint is reachable through those overlays. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/152.
2. GHCR anonymous release image readback once package visibility or authenticated distribution policy is decided. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/156.
3. Deployed StartOS/Umbrel UAT once real installed service URLs are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/157.
4. Signed iOS device/share-transfer UAT once macOS signing hardware and a real device are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/158.

---
*Roadmap updated: 2026-07-08 completing Phase 19 Loki Byte Transfer Proof.*
