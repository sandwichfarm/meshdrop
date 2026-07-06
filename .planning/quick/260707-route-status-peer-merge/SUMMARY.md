# Route Status And Peer Merge Summary

## Changed

- Nostr follow-list WOT is the default MeshDrop discovery model.
- FIPS and Pollen discovery rooms are derived in the browser from the logged-in npub follow list and NIP-65 relay hydration.
- Static discovery npub env wiring is removed from compose, packaging, scripts, and server config.
- `npub-network:unconfigured` remains only for explicit public/debug discovery.
- Generic FIPS peers are logged as route candidates and are not probed as MeshDrop HTTP servers.
- WebRTC route status events now drive pending-card copy such as Nostr/FIPS/Pollen connecting, ICE, timeout, and selected-route states.
- Same Nostr pubkey across Nostr/FIPS/Pollen/instance routes merges into one peer while preserving route-specific signaling target IDs.
- Sessionless WebRTC answers are rejected; no legacy compatibility path remains.

## Verified

- `node --check public/scripts/nostr-relays.js && node --check public/scripts/fips-discovery.js && node --check public/scripts/pollen-transfer.js && node --check public/scripts/network.js`
- `node --check server/ws-server.js && node --check server/federation-config.js && node --check server/fips-control.js`
- `node --test test/nostr-discovery-protocol.test.js test/ws-room.test.js test/fips-control.test.js test/federation-server.test.js test/action-visibility.test.js test/pollen-transfer-protocol.test.js test/rtc-peer-signaling.test.js test/peer-availability-protocol.test.js test/start9-package.test.js test/umbrel-package.test.js test/uat-runbooks.test.js`
- `npm test`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Slop Gate

Changed-code scan reported zero formatting, AI-slop, security, and lint issues. It still exits non-zero on existing structural warnings for large legacy files and duplicate blocks in changed legacy files.

Full scan remains baseline non-zero on existing large-file/duplicate warnings, vendored noble-ciphers lint warnings, and one pre-existing hardcoded URL warning.
