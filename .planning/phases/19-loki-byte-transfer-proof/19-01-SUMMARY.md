# Phase 19 Summary: Loki Byte Transfer Proof

Status: Complete.

## Delivered

- Added `scripts/loki-stream-smoke.mjs` and `npm run test:loki-stream`.
- Built a Dockerized Lokinet proof image from the official Oxen Debian package repo.
- Ran Lokinet inside an isolated NET_ADMIN container with `/dev/net/tun`, `lokitun0`, and DNS on `127.3.2.1:53`.
- Ran MeshDrop inside the same container and configured a generated `.loki` stream endpoint.
- Uploaded and downloaded a proof payload through the generic overlay stream endpoints using plain `.loki` DNS resolution.
- Recorded ADR 0011 and updated GSD roadmap/requirements/state for phase 19.

## Evidence

- Red guard failed until the Loki script/package/state existed.
- `node --test test/docker-smoke-script.test.js test/route-contract.test.js test/route-blocker-issues.test.js` -> 16/16 pass.
- `npm run test:loki-stream` emitted `Proof loki-http-stream` with generated `.loki`, resolver `127.3.2.1:53`, interface `lokitun0`, 43/43 bytes, hash matched, and fallback disabled.
- `npm test` -> 370/370 pass.

## Remaining Gaps

- Loki WebRTC is not proven.
- Public Lokinet reachability is not proven.
- FIPS/Pollen route-specific WebRTC relay proof remains tracked by issue #152.
