# NIP-TBD: MeshDrop Device Pairing

`draft` `optional`

This NIP defines a Nostr-native rendezvous flow for pairing two devices when the devices do not yet know each other's pubkeys.
It complements NIP-17, which remains the preferred path when the recipient pubkey is already known.

The provisional event kinds in this draft are:

- `20382`: MeshDrop pairing offer
- `20383`: MeshDrop pairing claim

Both kinds are ephemeral events.

## Motivation

NIP-17 direct messages work after a sender knows the recipient pubkey and DM relays. Device pairing often starts earlier:
one device shows a QR code or short code, and the other device uses that code to establish contact.

A server-side pair key solves this inside one instance, but it makes pairing instance-native. A Nostr-native flow needs the
rendezvous state to be signed, relayed, short-lived, and independent of one MeshDrop deployment.

## Pairing offer

The initiating device creates a high-entropy pairing secret and publishes a `kind:20382` event:

```json
{
  "kind": 20382,
  "content": "",
  "tags": [
    ["t", "meshdrop-pairing"],
    ["challenge", "<sha256(pairing-secret)>", "sha256"],
    ["relay", "wss://bucket.coracle.social"],
    ["expiration", "<unix timestamp>"],
    ["client", "meshdrop"]
  ]
}
```

The pairing offer MUST be signed by the initiating user's Nostr key.

The pairing secret MUST NOT be published in the offer. It MAY be embedded in a QR code or copyable link together with a
NIP-19 `nevent` pointer to the offer and relay hints.

Example QR/link payload:

```json
{
  "type": "meshdrop-pairing",
  "offer": "<nevent for kind:20382 offer>",
  "secret": "<pairing-secret>",
  "relays": ["wss://bucket.coracle.social"]
}
```

For manually typed short codes, clients SHOULD use the short code only as a rendezvous hint and MUST require visible user
confirmation on both devices before completing the pairing.

## Pairing claim

The joining device resolves the offer, verifies that `sha256(pairing-secret)` matches the offer's `challenge` tag, and
publishes a `kind:20383` claim:

```json
{
  "kind": 20383,
  "content": "",
  "tags": [
    ["e", "<offer-event-id>", "<offer-relay>", "<offer-author-pubkey>"],
    ["p", "<offer-author-pubkey>", "<offer-author-relay>"],
    ["response", "<hmac-sha256(pairing-secret, offer-id || claimant-pubkey)>"],
    ["expiration", "<unix timestamp>"],
    ["client", "meshdrop"]
  ]
}
```

The claim MUST be signed by the joining user's Nostr key.

The joining client SHOULD publish the claim to the offer relay and to the initiating user's NIP-65 read relays when known.

The initiating client SHOULD subscribe for claims with indexed tags:

```json
{
  "kinds": [20383],
  "#e": ["<offer-event-id>"],
  "#p": ["<offer-author-pubkey>"],
  "since": "<offer-created-at>"
}
```

## Pairing completion

After the initiating device verifies the claim response, it SHOULD complete pairing by sending a NIP-17 invitation to the
claimant pubkey.

The invitation SHOULD reference a MeshDrop transfer room as defined by NIP-TBD: MeshDrop Transfer Rooms:

```json
{
  "kind": 14,
  "content": "MeshDrop device pairing accepted",
  "tags": [
    ["p", "<claimant-pubkey>", "<claimant-dm-relay>"],
    ["e", "<claim-event-id>", "<claim-relay>"],
    ["a", "30382:<room-author-pubkey>:<room-id>", "<room-relay>"],
    ["client", "meshdrop"],
    ["room-secret", "<optional secret>"]
  ]
}
```

Any durable room secret, transfer capability token, or private device label MUST be inside the encrypted NIP-17 rumor tags.

## Known-recipient fast path

If the initiating device already knows the recipient pubkey, clients SHOULD skip `kind:20382` and `kind:20383` entirely.
Instead, send the MeshDrop room invitation directly through NIP-17 to the recipient's `kind:10050` DM relays.

## Relay selection

Clients SHOULD publish offers and claims to the relays embedded in the pairing QR/link. MeshDrop clients SHOULD use
`wss://bucket.coracle.social` for WebRTC-related rendezvous unless configuration overrides it.

For user-authored durable data, clients SHOULD follow NIP-65 outbox behavior:

- Fetch room definitions from the room author's write relays.
- Publish tagged-user notifications to each tagged user's read relays.
- Use NIP-17 `kind:10050` DM relays for encrypted pairing completion.

## Security considerations

The pairing secret is the bearer capability for claiming an offer. QR payloads SHOULD contain at least 128 bits of randomness.

Short manually typed codes are low entropy. Clients MUST pair low-entropy codes with human confirmation, rate limiting, and
short expiration windows.

The `expiration` tag is not a secrecy guarantee. Relays may retain events after expiration, so offers and claims MUST NOT
contain room secrets or private network coordinates.

Clients MUST verify:

- the offer signature;
- the claim signature;
- the offer challenge against the local pairing secret;
- the claim response against the offer ID and claimant pubkey;
- the final NIP-17 sender pubkey before accepting encrypted room material.

Pairing claims are replayable while the offer is valid unless clients track consumed offer IDs. Initiators SHOULD accept only
the first valid claim unless the UI explicitly allows multiple devices to join.

## Compatibility

This NIP does not replace NIP-17 direct messages. It only defines the pre-DM rendezvous for devices that do not yet know each
other's pubkeys.

Clients MAY keep instance-native pair keys as a fallback when no signer or relay is available. Once both devices have Nostr
pubkeys, pairing SHOULD complete through NIP-17 and durable rooms SHOULD be represented by `kind:30382` room definitions.
