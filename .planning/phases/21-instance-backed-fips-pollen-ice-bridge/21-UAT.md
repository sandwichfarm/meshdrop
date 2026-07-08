# Phase 21 UAT: Instance-Backed FIPS/Pollen ICE Bridge

## Acceptance Checks

- Trusted WOT route response can carry `iceBridge.source = "instance"` without public federation advertisement.
- Direct Clearnet disabled plus trusted FIPS/Pollen descriptor bridge config allows route setup.
- Direct Clearnet disabled plus no descriptor/global bridge config blocks route setup with `overlay-bridge-unavailable`.
- Created RTC config for the selected route uses only descriptor bridge ICE servers and `iceTransportPolicy: "relay"`.
- Route copy/status names WOT discovery/signaling, instance ICE bridge, and FIPS stream/Pollen storage as separate surfaces.

## Evidence Log

- Focused: `node --test test/relay-ice-config.test.js test/runtime-capabilities.test.js test/nostr-mesh-protocol.test.js test/rtc-peer-signaling.test.js test/peer-availability-protocol.test.js test/header-copy.test.js test/action-visibility.test.js` -> 121/121 pass.
- Executable smoke: `npm run test:instance-ice-bridge` -> FIPS and Pollen created selected `RTCPeerConnection` config with `iceTransportPolicy="relay"`, instance bridge TURN URLs, and `defaultClearnetIcePresent=false`; reported `provenTransfer=false`.
- Browser smoke: `npm run test:e2e` -> passed after updating stale route-choice terminology expectation; federated Pollen WebRTC and Pollen instance-relay scenarios passed.
- Broad: `npm test` -> 380/380 pass.
- Hygiene: `git diff --check` -> clean.
- AI-slop: `npx --yes aislop scan --changes .` -> exit 0; AI Slop, Security, Linting, and Formatting clean; code-quality warnings are existing large-file/duplicate-block style findings.
