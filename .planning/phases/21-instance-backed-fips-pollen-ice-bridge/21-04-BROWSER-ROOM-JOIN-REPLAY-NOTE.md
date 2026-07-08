# 21-04 Browser Room Join Replay

## Symptom

FIPS/Pollen badge counts could show remote availability while the browser stayed stuck on separate peer bubbles:
- a direct Nostr bubble keyed by the WOT pubkey
- a FIPS/Pollen instance bubble keyed by the server route peer id

When clearnet was disabled, the instance bubble could stay as a random server peer id because the private route room join was fired before the WebSocket was connected and was not replayed.

## Cause

FIPS/Pollen controllers fired `join-*-room` once during enable or route descriptor acceptance. `ServerConnection.send()` drops messages while the WebSocket is not open, so early public or private room joins were lost.

Peer canonicalization only used `peer.nostrIdentity.pubkey` or direct Nostr room ids. Private FIPS/Pollen route descriptors already know the intended WOT peer pubkey, but that pubkey was not preserved into route metadata before peer creation.

## Fix

- FIPS and Pollen controllers replay active public rooms plus remembered private route rooms on `ws-connected`.
- Encrypted Nostr route descriptors preserve the remote peer pubkey in both requester and responder directions.
- `PeersManager` uses route metadata pubkeys as Nostr identity keys and collapses existing split peers when a later announcement reveals the same Nostr identity.

## Verification

- `node --test test/action-visibility.test.js test/rtc-peer-signaling.test.js test/nostr-mesh-protocol.test.js`
- `npm test`

