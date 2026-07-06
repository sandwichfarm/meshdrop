# Summary

MeshDrop discovery now defaults to Nostr web-of-trust instead of a static room:

- `npub-network:unconfigured` is no longer synthesized as the default discovery scope.
- Trusted MeshDrop peers are discovered through local Nostr identity follow/trust metadata and author-filtered Nostr subscriptions.
- NIP-100/WebRTC presence events advertise MeshDrop/WebRTC capability and are accepted only from trusted npubs unless explicit public discovery is enabled.
- Explicit public/debug rooms remain opt-in through `MESHDROP_PUBLIC_DISCOVERY=true`.
- FIPS and Pollen are route substrates. Generic FIPS/Pollen peers are logged as route candidates and are not probed as MeshDrop HTTP servers.
- MeshDrop HTTP federation runs only after a trusted signed Nostr event explicitly advertises a MeshDrop HTTP base or Pollen service.
- Route priority is direct/local WebRTC first, then direct Nostr WebRTC, then FIPS, then Pollen.
- UI copy and route chooser labels say `Nostr`, not `Relay`; empty WOT Nostr room ids still produce a selectable Nostr route.
- The Pollen/FIPS discovery NIP draft in `nips/meshdrop-pollen-discovery.md` now documents WOT default, explicit public/debug `#d` usage, and provisional kind `20385`.

## Evidence

- Focused federation/RTC: `node --test test/federation-server.test.js test/nostr-mesh-protocol.test.js test/rtc-peer-signaling.test.js test/signaling-room-priority.test.js` passed 70/70.
- Focused UI/Docker harness: `node --test test/peer-availability-protocol.test.js test/docker-smoke-script.test.js test/header-copy.test.js` passed 12/12.
- Repo: `npm test` passed 270/270.
- Browser: `npm run test:e2e` passed, including Nostr WebRTC transfer, generic FIPS route-candidate-only behavior, and trusted federated Pollen transfer.
- Docker: `npm run test:docker` passed, including signed admin FIPS save, local WebRTC, and two-container Nostr WebRTC transfer.
- Whitespace: `git diff --check` passed.
- Kind check: live `{"kinds":[20385],"limit":1}` REQ returned EOSE with 0 events on `wss://relay.damus.io`, `wss://relay.primal.net`, and `wss://nos.lol`.
- Changed-code AI-slop/security/lint: `npx --yes aislop scan --changes .` reports 0 formatting, lint, security, or AI-slop issues; it still exits nonzero on existing file-size/duplicate/long-function policy warnings in touched large files.
- Full-repo slop: `npx --yes aislop scan .` still fails on existing baseline warnings in vendored crypto/helpers, large files, and `server/nostr-identity.js`.

## Remaining Risk

The second physical MeshDrop instance must run this patched build and use a Nostr identity/follow relationship before it can see peers through default WOT discovery. Rooms are intentionally not the default path anymore; public/lobby/debug rooms require explicit opt-in.
