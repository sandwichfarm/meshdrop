---
status: complete
date: 2026-07-07
quick_id: 260707-prh
slug: harden-private-route-presence
---

# Summary: Harden Private Route Presence

## Changed

- Nostr Mesh presence now advertises a single `capability=meshdrop-webrtc` token plus optional `fips-route` / `pollen-route`, random session peer id, and expiration.
- Default WOT presence no longer includes `client`, `protocol`, split `meshdrop`/`webrtc` capability tags, device/profile names, platform hints, IPs, FIPS bases, Pollen services, or invite strings.
- Trusted presence now requires the current `meshdrop-webrtc` capability instead of accepting the older split capability shape.
- Plaintext route request/response bodies are covered by regression tests and fail before route rooms are joined or responses are published.
- Route-capability accept/reject logging was added with route names, reason, and pubkey prefix only.
- Shared addressed-event tag construction was extracted to remove the duplicate block in Nostr signal and route event publishing.

## Verification

- `npm ci`
- `node --check public/scripts/nostr-mesh.js`
- `node --test test/nostr-mesh-protocol.test.js` passed 18/18.
- `node --test test/rtc-peer-signaling.test.js test/local-discovery-protocol.test.js test/action-visibility.test.js test/header-copy.test.js test/peer-availability-protocol.test.js test/nostr-mesh-protocol.test.js` passed 104/104.
- `npm test` passed 300/300.
- `npm run test:e2e` passed local WebRTC, Blossom, Hashtree, Pollen storage, direct Nostr WebRTC, generic FIPS route-candidate-only, and federated Pollen-signaled WebRTC browser proofs.
- `npm run test:docker` passed Docker image build, signed admin GUI, container local WebRTC, and two-host Nostr WebRTC proof.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0; AI-slop/security/lint clean, with one pre-existing changed-file size warning on `public/scripts/nostr-mesh.js`.
- `npx --yes aislop scan .` exited 1 on baseline warnings: vendored noble-ciphers unused expressions, existing large files/duplicates, long functions, `server/nostr-identity.js` hardcoded URL, vendored TODOs, and one empty vendored helper.

## Risks

- `public/scripts/nostr-mesh.js` remains a large file; this task removed the local duplicate block but did not split the module.
- Route descriptors still carry private route room ids, not TURN/relay-only ICE descriptors. WebRTC-over-FIPS/Pollen relay-only transport remains a separate implementation slice.
