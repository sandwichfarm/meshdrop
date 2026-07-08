# Roadmap: MeshDrop v0.17.0 Instance-Backed FIPS/Pollen ICE Bridge

## Phase 21: Instance-Backed FIPS/Pollen ICE Bridge

Goal: let trusted WOT-negotiated FIPS/Pollen private routes create bridge-constrained WebRTC peer connections using instance-backed route metadata, without public discovery or silent Clearnet fallback.

Current status: complete.

Requirements: IBR-01, IBR-02, IBR-03, IBR-04, IBR-05, IBR-06.

Success criteria:

1. Server runtime capabilities expose instance-backed FIPS/Pollen ICE bridge descriptors.
2. Trusted WOT route descriptors preserve route-scoped `iceBridge` metadata.
3. FIPS/Pollen route selection uses descriptor ICE bridge config when direct Clearnet is disabled and legacy global TURN env vars are absent.
4. FIPS/Pollen route selection fails closed when no descriptor or global bridge config is available.
5. UI/status copy distinguishes WOT discovery/signaling, instance ICE bridge, and FIPS stream/Pollen storage transfer.
6. Executable smoke proves selected route setup uses descriptor bridge-constrained ICE and not default Clearnet ICE.

Verification:

- Focused: relay config, runtime capabilities, Nostr route metadata, RTC route selection, copy/status tests.
- Smoke: `npm run test:instance-ice-bridge`.
- Broad: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

Completion evidence:

- `node --test test/relay-ice-config.test.js test/runtime-capabilities.test.js test/nostr-mesh-protocol.test.js test/rtc-peer-signaling.test.js test/peer-availability-protocol.test.js test/header-copy.test.js test/action-visibility.test.js` -> 121/121 pass.
- `npm run test:instance-ice-bridge` -> FIPS and Pollen selected route setup used `iceTransportPolicy="relay"`, instance bridge TURN URLs, and no default Clearnet/STUN ICE config; `provenTransfer=false` by design.
- `npm test` -> 380/380 pass.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> exit 0; AI Slop, Security, Linting, and Formatting clean; code-quality warnings remain for existing large files/duplicate blocks.

## Future Milestone Queue

1. GHCR anonymous release image readback once package visibility or authenticated distribution policy is decided. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/156.
2. Deployed StartOS/Umbrel UAT once real installed service URLs are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/157.
3. Signed iOS device/share-transfer UAT once macOS signing hardware and a real device are available. Current blocker: https://github.com/sandwichfarm/meshdrop/issues/158.

---
*Roadmap updated: 2026-07-08 completing Phase 21 Instance-Backed FIPS/Pollen ICE Bridge.*
