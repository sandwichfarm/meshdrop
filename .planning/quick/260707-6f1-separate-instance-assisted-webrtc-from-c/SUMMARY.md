---
status: complete
completed: 2026-07-07
slug: separate-instance-assisted-webrtc-from-c
---

# Summary

Separated Instance-assisted WebRTC from direct Clearnet/Nostr-signaled WebRTC. The Instance toggle now gates only same-instance `ip` routes. A new Clearnet route toggle gates only direct Nostr-signaled WebRTC routes while leaving Nostr discovery/signaling available for private FIPS/Pollen route requests. Peer cards and footer copy now label same-instance routes as `Instance`.

## Changed

- Added `ClearnetRouteProtocol` and `ClearnetRouteController` with separate persistence and header control.
- Updated route policy so `ip` asks Instance policy and `nostr` asks Clearnet policy.
- Scoped Clearnet-disable route events to `nostr`, so disabling Clearnet no longer disables same-instance sharing.
- Preserved existing RTC peer routes when the user turns off Nostr mesh signaling.
- Updated SPA/target/Docker smokes and route labels for the new ontology.

## Evidence

- Red proof: focused tests failed before implementation because no `ClearnetRouteProtocol` existed, `LocalDiscoveryProtocol` still gated `nostr`, Clearnet disable removed `ip`, and Nostr mesh toggle emitted `peer-left`.
- `node --check public/scripts/local-discovery.js public/scripts/network.js public/scripts/nostr-mesh.js public/scripts/ui.js public/scripts/main.js` passed.
- `node --test test/local-discovery-protocol.test.js test/rtc-peer-signaling.test.js test/peer-availability-protocol.test.js test/action-visibility.test.js test/header-copy.test.js test/nostr-mesh-protocol.test.js` passed 103/103.
- `npm test` passed 299/299.
- `npm run test:e2e` passed with local WebRTC, Blossom, Hashtree, Pollen storage, direct Nostr WebRTC, generic FIPS route-candidate, and federated Pollen-signaled WebRTC proofs.
- `npm run test:docker` passed with served-page check, signed admin FIPS GUI proof, local WebRTC proof, and two-host Nostr WebRTC proof.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with no formatting, AI-slop, security, or lint issues; inherited duplicate/large-file code-quality warnings remain in touched legacy files.
- `npx --yes aislop scan .` remains baseline-failing on vendored noble-ciphers lint warnings, large/duplicate/long-function warnings, `server/nostr-identity.js` hardcoded URL, and vendored TODO/stub findings.

## Remaining Risk

- Direct Nostr-signaled WebRTC is still a Clearnet data path. FIPS/Pollen signaling can discover/request routes, but browser ICE may still use clearnet bytes until real relay-only FIPS/Pollen ICE candidates exist.
