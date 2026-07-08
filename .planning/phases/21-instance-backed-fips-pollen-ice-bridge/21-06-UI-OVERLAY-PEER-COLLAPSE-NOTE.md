# 21-06 UI Overlay Peer Collapse

## Symptom

After the network layer stopped using anonymous FIPS/Pollen candidates, the radar could still show dangling overlay bubbles such as a random-name Pollen peer. Same-instance and Nostr announcements for the same browser could also appear as two bubbles when the UI model saw the raw room events in a different order than the connection manager.

## Cause

`PeersManager` and `PeersUI` keep separate peer maps. The network layer blocked unbound FIPS/Pollen candidates and merged by Nostr pubkey, but `PeersUI` still rendered raw `peer-joined` events without the same identity gate. Its grouping also only considered `nostrIdentity.pubkey`, not private descriptor `peerPubkey` metadata.

## Fix

- `PeerAvailabilityProtocol.identityKeys()` now includes private route descriptor pubkeys.
- `PeersUI` derives FIPS/Pollen route metadata from the controller room before deciding whether a peer has a Nostr identity key.
- `PeersUI` ignores FIPS/Pollen candidates that still have no Nostr identity key.
- `PeersUI` keeps using identity keys to resolve same-instance and Nostr peer records to one visible bubble.

## Verification

- `node --test test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js`
- `npm test`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .` still reports pre-existing baseline warnings in vendored noble cipher code, oversized files, duplicate blocks, and `server/nostr-identity.js` URL policy.
