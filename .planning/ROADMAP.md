# Roadmap: MeshDrop v0.13.0 Tor Byte Transfer Proof

## Phase 17: Tor Byte Transfer Proof

Goal: prove a real Tor overlay stream data path by transferring bytes through a Dockerized `.onion` endpoint and emitting route proof.

Current status: planned.

Requirements: TOR-BYTE-01, TOR-BYTE-02, TOR-BYTE-03, TOR-BYTE-04, TOR-BYTE-05.

Success criteria:

1. Generic overlay stream upload/download endpoints store short-lived payloads and enforce token, expiry, hash, and max-byte limits.
2. Tor stream descriptors validate `.onion` endpoints and preserve private/encrypted/fail-closed route constraints.
3. `npm run test:tor-stream` starts Tor in Docker, publishes a MeshDrop onion service, downloads the payload through that onion route, and proves the hash and byte counts.
4. The emitted route proof has `routeType=tor`, `dataPlanePrimitive=tor-http-stream`, `webRtcUsed=false`, `fallbackUsed=false`, and topology evidence naming the onion endpoint.
5. I2P and Loki remain fail-closed and issue #151 stays open for their future proof.

Verification:

- Focused: route contract, runtime capability, and overlay stream transfer unit tests.
- Runtime: `npm run test:tor-stream`.
- Broad: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- Pending.

## Future Milestone Queue

1. I2P/Loki byte-transfer proof with real local daemon/proxy dial evidence. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/151.
2. FIPS/Pollen route-specific WebRTC relay proof using the generic TURN proof harness once a relay endpoint is reachable through those overlays. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/152.
3. GHCR anonymous release image readback once package visibility or authenticated distribution policy is decided. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/156.
4. Deployed StartOS/Umbrel UAT once real installed service URLs are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/157.
5. Signed iOS device/share-transfer UAT once macOS signing hardware and a real device are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/158.

---
*Roadmap updated: 2026-07-07 starting milestone v0.13.0 Tor Byte Transfer Proof.*
