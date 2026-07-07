---
status: complete
date: 2026-07-07
quick_id: 260707-clearnet-exclusion-private-routes
slug: clearnet-exclusion-private-routes
---

# Summary: Clearnet Exclusion Still Uses Nostr Route Discovery

## Changed

- Disabled Clearnet file routes no longer drop useful Nostr WOT presence when the peer advertises FIPS or Pollen route capability.
- Disallowed direct Nostr-signaled WebRTC now seeds a pending private-route peer, emits an encrypted route request, and creates the first real RTCPeer only when an allowed FIPS/Pollen route candidate arrives.
- Pending private route state is carried into the promoted RTCPeer so returned FIPS/Pollen candidates clear the matching request and keep the same Nostr identity grouping.

## Verification

- `node --test test/rtc-peer-signaling.test.js` passed: 31/31.
- `node --test test/local-discovery-protocol.test.js test/header-copy.test.js test/footer-discovery-protocol.test.js` passed: 7/7.
- `node --test test/action-visibility.test.js` passed: 36/36.
- `npm test` passed: 293/293.
- `npm run test:e2e` passed: local WebRTC, Blossom, Hashtree, Pollen storage, direct Nostr WebRTC, FIPS route-candidate-only, and federated Pollen-signaled WebRTC proofs.
- `npm run test:docker` passed: Docker local WebRTC, signed admin GUI FIPS settings, and two-host Nostr WebRTC proof.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0; formatting, AI-slop, security, and lint clean; existing large-file/duplicate warnings remain in `network.js`.
- `npx --yes aislop scan .` exited 1 on existing full-repo baseline: vendored noble-ciphers lint warnings, large files/duplicates, long functions, `server/nostr-identity.js` hardcoded URL, vendored TODOs/empty helper.

## Risks

- This forces signaling/route selection away from direct clearnet when Clearnet is excluded, but it still uses browser ICE after the FIPS/Pollen signaling route is selected. True TURN/relay-only data-plane encapsulation over FIPS/Pollen remains a separate transport-relay slice.
- Pending private route requests still depend on route descriptor responses from the remote peer; a peer that advertises capability but never responds stays in requested route status until later peer cleanup.
