# Phase 15 Summary: TURN Relay Proof

## Result

Complete. MeshDrop now has a deterministic local TURN relay-only browser transfer proof before any overlay WebRTC route can be labeled as byte-carrying.

## Delivered

- Added `webrtc-relay-ice` proof validation: selected ICE candidate type is required and must be `relay`.
- Added `npm run test:turn-relay`, which starts coturn in Docker, starts MeshDrop with generated relay-only RTC config, transfers a proof payload between two browser peers, extracts selected candidate-pair stats, and validates the route proof.
- Split the TURN smoke into entry, browser, and runtime modules so changed-code slop stays clean.
- Added ADR 0007 documenting the boundary: generic TURN proof is prerequisite proof, not route-specific FIPS/Pollen/Tor/I2P/Loki proof.

## Evidence

- `node --test test/route-contract.test.js test/docker-smoke-script.test.js test/relay-ice-config.test.js test/runtime-capabilities.test.js test/rtc-peer-signaling.test.js` -> 58/58 pass.
- `npm run test:turn-relay` -> `Proof turn-relay-webrtc` with `selectedIceCandidateType:"relay"`, sender/receiver relay candidate pairs, 66/66 bytes, hash matched, fallback disabled.
- `npm test` -> 355/355 pass.
- `npm run test:e2e` -> local, Blossom, Hashtree, Pollen storage, Nostr WebRTC, FIPS route-candidate-only, federated Pollen WebRTC, and Pollen instance relay proofs pass.
- `npm run test:docker` -> Docker browser transfer smoke and two-host Nostr WebRTC proof pass.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> clean.
- `npx --yes aislop scan .` -> baseline fail outside touched files: vendored noble-ciphers lint warnings, existing large files, duplicate blocks in `public/scripts/network.js`, and `server/nostr-identity.js` hardcoded URL warning.

## Remaining Blockers

- Tor/I2P/Loki byte-transfer proof remains blocked on this host because no local daemon/proxy binaries or listening ports were found.
- `sandwichfarm/meshdrop` has GitHub issues disabled, so those blockers cannot be filed as issues yet. They remain tracked in GSD and PR artifacts.
