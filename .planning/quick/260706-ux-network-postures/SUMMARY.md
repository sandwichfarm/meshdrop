---
status: complete
quick_id: 260706-ux-network-postures
slug: ux-network-postures
date: 2026-07-06
---

# Summary: UX Network Postures

## Result

Shared web runtime now presents LAN, FIPS, Pollen, and relay discovery as network postures wherever the target exposes
those features. Blossom and Hashtree are grouped as storage routes. The transfer chooser now asks for privacy before
route choice, defaults to Private, confirms Unencrypted sends, and encrypts Private file payloads before direct,
Hashtree, and Pollen sends. Blossom remains encrypted-only.

## Changed

- Added Pollen discovery badge/count support to footer and header action state.
- Reordered shared network controls and footer badges to LAN, FIPS, Pollen, Relay.
- Renamed misleading WEB-RTC-facing copy to Nostr relay signaling where it describes discovery, while keeping WebRTC as
  the peer data-channel capability.
- Grouped transfer choices into Network routes and Storage routes with capability details.
- Added `TransferPrivacyProtocol` and reused Blossom AES-GCM payload encryption for direct, Hashtree, and Pollen routes.
- Added private payload regression tests for direct, Hashtree, and Pollen requests.

## Verification

- `node --test test/blossom-key-delivery.test.js test/footer-discovery-protocol.test.js test/peer-availability-protocol.test.js test/header-copy.test.js test/action-visibility.test.js` passed 43/43.
- `npm test` passed 241/241.
- `npm run test:e2e` passed, proving local, Blossom, Hashtree, FIPS, Pollen mesh, Pollen storage, Nostr, and federated
  FIPS browser transfers.
- `npm run test:docker` passed, proving Docker-served local, Pollen, admin, and two-host Nostr browser transfer smoke.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` had Formatting, AI Slop, Security, and Linting clean; remaining warnings are
  code-quality policy warnings for pre-existing large files/duplicate blocks in changed legacy files.
- `npx --yes aislop scan .` still fails baseline on pre-existing third-party lint warnings, large files, duplicate
  blocks, and `server/nostr-identity.js:11` hardcoded URL.

## Remaining Risk

- Private key delivery is fail-closed unless the route uses RTC data channel or NIP-44 key wrapping. WS/server fallback
  cannot honestly be private without recipient key wrapping.
- Full-repo AI-slop baseline is still failing outside this task's functional changes.
