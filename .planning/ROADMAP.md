# Roadmap: MeshDrop v0.11.0 TURN Relay Proof

## Phase 15: TURN Relay Proof

Goal: prove browser WebRTC can transfer file bytes over a configured relay-only TURN path before MeshDrop labels overlay WebRTC routes as byte-carrying paths.

Current status: complete.

Requirements: TURN-01, TURN-02, TURN-03, TURN-04, TURN-05.

Success criteria:

1. A focused relay proof test fails first because no smoke currently proves relay-only selected candidate pairs.
2. A local coturn-backed smoke starts TURN plus MeshDrop with generated RTC config and transfers a proof payload between two browser peers.
3. Proof output names sender/recipient runtime, selected route type, primitive, WebRTC use, instance relay flag, byte counts, hash match, fallback status, and selected ICE candidate type.
4. Runtime/route tests keep overlay WebRTC unavailable without relay ICE config and fail closed when relay-only policy cannot connect.
5. ADR/docs record that TURN relay proof is a prerequisite for FIPS/Pollen/Tor/I2P/Loki WebRTC overlay claims, not proof of those specific overlays by itself.

Verification:

- Focused: relay ICE config, route policy, and relay proof extraction tests.
- Runtime: `npm run test:turn-relay` proves local relay-only WebRTC byte transfer with selected candidate type `relay`.
- Browser: `npm run test:e2e` because WebRTC proof reporting changes.
- Broad local: `npm test`.
- Docker: `npm run test:docker`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- `node --test test/route-contract.test.js test/docker-smoke-script.test.js test/relay-ice-config.test.js test/runtime-capabilities.test.js test/rtc-peer-signaling.test.js` -> 58/58 pass.
- `npm run test:turn-relay` -> `Proof turn-relay-webrtc` with `selectedIceCandidateType:"relay"`, sender/receiver relay candidate pairs, 66/66 bytes, hash matched, fallback disabled.
- `npm test` -> 355/355 pass.
- `npm run test:e2e` -> local, Blossom, Hashtree, Pollen storage, Nostr WebRTC, FIPS route-candidate-only, federated Pollen WebRTC, and Pollen instance relay proofs pass.
- `npm run test:docker` -> Docker browser transfer smoke and two-host Nostr WebRTC proof pass.
- `git diff --check` and `npx --yes aislop scan --changes .` pass.
- `npx --yes aislop scan .` still fails on pre-existing baseline outside touched files.

## Future Milestone Queue

1. Tor/I2P/Loki byte-transfer proof with real local daemon/proxy dial evidence. Current blocker: no Tor/I2P/Loki daemon/proxy exists on this host, and GitHub issues are disabled for `sandwichfarm/meshdrop`.
2. FIPS/Pollen route-specific WebRTC relay proof using the generic TURN proof harness once a relay endpoint is reachable through those overlays.

---
*Roadmap updated: 2026-07-07 completing milestone v0.11.0 TURN Relay Proof.*
