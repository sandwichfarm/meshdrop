# Roadmap: MeshDrop v0.16.0 Overlay Relay Proof Preflight

## Phase 20: Overlay Relay Proof Preflight

Goal: block false overlay WebRTC claims by requiring route-specific relay topology evidence and adding a preflight harness for the real FIPS/Pollen relay endpoint work tracked by #152.

Current status: complete.

Requirements: OVR-PRE-01, OVR-PRE-02, OVR-PRE-03, OVR-PRE-04.

Success criteria:

1. Generic `turn-relay` WebRTC proof still passes with selected ICE candidate type `relay`.
2. FIPS/Pollen/Tor/I2P/Loki `webrtc-relay-ice` proofs fail unless topology evidence names the same overlay and selected relay endpoint.
3. `npm run test:overlay-relay-preflight` fails closed without route-specific relay ICE config or topology evidence.
4. The preflight passes with matching route-specific TURN/TURNS config and topology evidence while explicitly reporting `provenTransfer=false`.
5. Issue #152 remains the tracker for real FIPS/Pollen WebRTC bytes through an overlay-reachable relay endpoint.

Verification:

- Red guard: focused tests fail before the route contract guard and preflight script exist.
- Focused: route contract, preflight helper, Docker smoke script, and blocker issue tests.
- Preflight: configured `npm run test:overlay-relay-preflight` with matching FIPS relay topology evidence.
- Broad: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- Red guard: `node --test test/route-contract.test.js test/overlay-relay-preflight.test.js test/docker-smoke-script.test.js` failed until the contract topology guard, preflight script, and package script existed.
- `node --test test/route-contract.test.js test/overlay-relay-preflight.test.js test/docker-smoke-script.test.js test/route-blocker-issues.test.js` -> 21/21 pass.
- Configured `npm run test:overlay-relay-preflight` -> `preflight-ready`, matching FIPS relay endpoints, issue #152 blocker URL, and `provenTransfer=false`.
- `npm test` -> 375/375 pass.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.

## Future Milestone Queue

1. FIPS/Pollen route-specific WebRTC relay proof using the generic TURN proof harness once a relay endpoint is reachable through those overlays and passes the preflight. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/152.
2. GHCR anonymous release image readback once package visibility or authenticated distribution policy is decided. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/156.
3. Deployed StartOS/Umbrel UAT once real installed service URLs are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/157.
4. Signed iOS device/share-transfer UAT once macOS signing hardware and a real device are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/158.

---
*Roadmap updated: 2026-07-08 completing Phase 20 Overlay Relay Proof Preflight.*
