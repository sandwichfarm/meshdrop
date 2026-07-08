# 21-05 Anonymous Overlay Peer Suppression

## Symptom

FIPS/Pollen toolbar counts could show available overlay participants while the radar also rendered extra anonymous peer bubbles such as random animal-name peers. On a second device, the same state could appear as two anonymous overlay peers plus one real Nostr/WOT peer.

## Cause

Public FIPS/Pollen overlay room announcements can arrive with only a transport-local server peer id. Without a `nostrIdentity.pubkey` or private route descriptor `peerPubkey`, the browser cannot bind that candidate to a WOT identity. `PeersManager` still created RTC peers for those candidates, so they became visible bubbles and inflated FIPS/Pollen peer counts.

## Fix

- `PeersManager` now ignores FIPS/Pollen peer candidates that lack a Nostr pubkey or route descriptor peer pubkey.
- Private descriptor routes still work because their route metadata carries the intended WOT peer pubkey.
- Identity-bearing public overlay candidates still attach to the Nostr peer record instead of creating a detached anonymous bubble.

## Verification

- `node --test test/rtc-peer-signaling.test.js`
- `node --test test/action-visibility.test.js test/nostr-mesh-protocol.test.js`
