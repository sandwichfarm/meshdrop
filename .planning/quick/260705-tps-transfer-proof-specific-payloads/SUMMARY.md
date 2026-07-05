---
status: complete
completed: 2026-07-05
---

# Transfer Proof Specific Payloads Summary

## Result

Docker browser transfer smokes now send and assert proof files that are unique to the claimed transfer path.

## Changed

- `scripts/docker-browser-transfer-smoke.mjs`
  - Local and Pollen Docker browser transfer proofs now send `meshdrop-<scenario>-proof.txt`.
  - Assertions require exact proof file name and exact scenario/transport payload text.
- `scripts/docker-two-host-relay-smoke.mjs`
  - Two-host and public-relay Nostr WebRTC proofs now send `meshdrop-<proof-name>-proof.txt`.
  - Assertions require exact proof file name and exact attempt/relay-count payload text.
- `test/docker-smoke-script.test.js`
  - Guard test now checks for scenario-specific proof payload construction.

## Verification

- `node --check scripts/docker-browser-transfer-smoke.mjs && node --check scripts/docker-two-host-relay-smoke.mjs`
- `node --test test/docker-smoke-script.test.js`
- `npm ci`
- `npm test` -> 206/206 pass
- `git diff --check`
- `npm run test:docker`
  - `Proof docker-local-webrtc: local delivered meshdrop-docker-local-webrtc-proof.txt`
  - `Proof docker-pollen-webrtc: pollen-mesh delivered meshdrop-docker-pollen-webrtc-proof.txt`
  - `Proof docker-two-host-nostr-webrtc: nostr delivered meshdrop-docker-two-host-nostr-webrtc-proof.txt between two Docker instances`
- `npx --yes aislop scan --changes .` -> clean, 100/100
- `npx --yes aislop scan .` -> baseline failing with 57 pre-existing warnings outside this change

## Known Gaps

- Physical Android/iOS device UAT remains unproven.
- StartOS and Umbrel real-device/node UAT remain unproven.
- Anonymous GHCR readback remains blocked by GHCR `unauthorized`.
