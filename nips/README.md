# MeshDrop Nostr-native rooms and pairing

Audience: MeshDrop maintainers and Nostr implementers deciding how device pairing and room membership should move from
instance-owned state to signed Nostr events.

Post-read action: implement the migration in phases, using existing NIPs where they fit and the draft event kinds here for the
two missing pieces: client-owned transfer rooms and no-prior-contact pairing.

## Current problem

MeshDrop's PairDrop-derived room model is instance-native today:

- Device pairing creates a server-side pair key and server-side room secret.
- Joining a paired device consumes the server-side pair key.
- Public rooms are short IDs whose existence and membership live in the WebSocket server's room map.
- Nostr WebRTC signaling already exists, but the room value defaults to an instance-derived string such as
  `meshdrop:<location.host>`.

That means two MeshDrop instances can share Nostr signaling relays and identities, but they do not share a portable definition
of "this room" or "these two devices are paired".

## Existing NIPs that should be reused

- [NIP-01](https://nips.nostr.com/1) gives the event model, indexed tags, `a` tags, ephemeral kind range
  `20000 <= kind < 30000`, and addressable kind range `30000 <= kind < 40000`.
- [NIP-17](https://nips.nostr.com/17) should carry private room invitations once the recipient pubkey is known. It already
  uses NIP-44 encryption and NIP-59 gift wraps, and NIP-17 room membership is defined by the sender pubkey plus `p` tags.
- [NIP-40](https://nips.nostr.com/40) should be used for short-lived pairing offers and temporary room invites through the
  `expiration` tag.
- [NIP-65](https://nips.nostr.com/65) should be the outbox source for user-authored room definitions and related discovery:
  read from a user's write relays when fetching their authored events, and publish to their write relays plus tagged users'
  read relays.
- [NIP-51](https://nips.nostr.com/51) can store a user's remembered rooms or servers as private list items, and it already
  standardizes `kind:10050` DM relays and `kind:10063` Blossom servers.
- [NIP-19](https://nips.nostr.com/19) should be used for copyable room and pairing links. Use `naddr` for addressable room
  definitions and `nevent` for one-shot pairing offers.
- [NIP-29](https://nips.nostr.com/29) is useful if MeshDrop intentionally wants relay-administered groups. It is not a good
  default for PairDrop-style rooms because the relay owns group policy and relay-generated metadata.
- [NIP-78](https://nips.nostr.com/78) could store MeshDrop-specific app data, but it is intentionally not interoperable. It is
  a fallback for private client preferences, not a protocol for rooms or pairing.
- [NIP-28](https://nips.nostr.com/28) and [NIP-72](https://nips.nostr.com/72) are marked unrecommended in favor of NIP-29, so
  they should not be the basis for new MeshDrop room behavior.

## Recommendation

Use existing NIPs for everything they cover:

1. Fetch identity and published metadata through NIP-65 outbox relays.
2. Send known-recipient room invitations through NIP-17 using the recipient's NIP-17 `kind:10050` DM relays.
3. Use NIP-40 `expiration` tags for temporary pairing offers and room invitations.
4. Use NIP-19 `naddr` and `nevent` strings for QR codes, copyable links, and share sheets.
5. Continue using the WebRTC announcement/signaling kind already implemented by MeshDrop, but set its room tag from a
   Nostr room coordinate instead of an instance hostname.

Add draft event kinds where existing NIPs do not fit:

- `kind:30382` for portable MeshDrop transfer room definitions.
- `kind:20382` for short-lived pairing offers.
- `kind:20383` for short-lived pairing claims.

These numbers are implementation draft numbers. If this is proposed upstream, the kind numbers may need to change during NIP
review.

## Why new kinds are necessary

Known-recipient pairing can be handled with NIP-17, but QR or short-code pairing starts before the two devices know each
other's pubkeys. NIP-17 cannot address an unknown receiver, and NIP-29 creates relay-owned groups rather than portable
client-owned transfer rooms.

MeshDrop also needs room metadata that is not a social chat channel, not a moderated community, and not a relay-administered
group. A transfer room is a signed coordination object for discovery, signaling, and transfer capability negotiation. That is
specific enough to warrant an addressable event kind rather than overloading public chat or app-private storage.

## Migration shape

1. Keep IP-room behavior local to an instance and LAN. It is intentionally instance-native.
2. Replace public-room IDs with `kind:30382` room definitions. The UI can still show a short code, but the shareable primitive
   should be an `naddr` with relay hints.
3. Replace paired-device room secrets with NIP-17 room invitations that reference a `kind:30382` room and include any private
   symmetric room material in the encrypted payload only.
4. Replace pair-key rendezvous with `kind:20382` pairing offers and `kind:20383` pairing claims for users who start from a QR
   code or short code.
5. Use the `kind:30382` room coordinate as the WebRTC room tag. The current `meshdrop:<host>` tag becomes a compatibility
   fallback, not the canonical room ID.

## Drafts

- [MeshDrop Transfer Rooms](./meshdrop-transfer-rooms.md)
- [MeshDrop Device Pairing](./meshdrop-device-pairing.md)
