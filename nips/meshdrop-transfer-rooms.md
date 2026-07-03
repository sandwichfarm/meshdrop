# NIP-TBD: MeshDrop Transfer Rooms

`draft` `optional`

This NIP defines a portable Nostr room definition for peer-to-peer transfer applications. It is intended for applications
that need a signed, shareable room coordinate for WebRTC discovery, LAN fallback, Blossom transfer metadata, hashtree
verification, and FIPS integration without making room ownership depend on one application server.

The provisional event kind in this draft is `30382`.

## Motivation

PairDrop-style applications commonly use a server process to create public room IDs, pair keys, and room membership maps. That
works inside one deployment, but it does not let independent deployments share the same room or let users recover rooms from
their Nostr identity.

Nostr already provides signatures, relays, relay discovery, encrypted direct messages, and shareable event coordinates. This
NIP adds the missing transfer-room object that those existing NIPs can reference.

## Room definition event

A room definition is an addressable event:

```json
{
  "kind": 30382,
  "content": "",
  "tags": [
    ["d", "<room-id>"],
    ["name", "<display name>"],
    ["summary", "<optional room summary>"],
    ["policy", "public"],
    ["relay", "wss://bucket.coracle.social", "webrtc"],
    ["relay", "wss://relay.example", "metadata"],
    ["transport", "webrtc"],
    ["transport", "lan"],
    ["transport", "blossom"],
    ["transport", "fips"],
    ["hashtree", "supported"],
    ["expiration", "<unix timestamp>"],
    ["client", "meshdrop"]
  ]
}
```

The `d` tag is the stable room identifier for this author's room. Clients SHOULD generate at least 128 bits of randomness for
new room IDs.

The event coordinate is:

```text
30382:<author-pubkey>:<room-id>
```

Clients SHOULD encode the coordinate as a NIP-19 `naddr` when showing a room QR code, copyable link, or share target.

## Tags

Required tags:

- `d`: stable room ID scoped to the author's pubkey.
- `policy`: one of `public`, `invite`, or `private`.

Recommended tags:

- `name`: short display name.
- `summary`: short user-facing room purpose.
- `relay`: relay URL plus an optional marker. Defined markers are `metadata`, `webrtc`, `dm`, and `archive`.
- `transport`: supported transport. Defined values are `webrtc`, `lan`, `blossom`, and `fips`.
- `expiration`: NIP-40 expiration timestamp for temporary rooms.
- `client`: client or application family that created the room.
- `hashtree`: `supported` when the room supports hashtree verification.
- `p`: invited or visible participant pubkey. The optional fourth value is a role such as `owner`, `admin`, or `member`.

Clients MAY add other tags. Unknown tags MUST be ignored.

## Policies

`public` rooms are discoverable by anyone who can resolve the room event. A public MeshDrop room MAY be shared as an `naddr`
and SHOULD NOT include secret transfer keys.

`invite` rooms require an invitation, but the room definition itself MAY be public. Clients SHOULD send invite material using
NIP-17 and SHOULD place only non-secret metadata in the room definition.

`private` rooms MUST NOT publish membership, room secrets, or sensitive metadata in the room definition. A private room
definition MAY contain only routing hints and capability tags. The private name, members, and transfer keys SHOULD be delivered
through NIP-17 gift-wrapped messages.

## Room invitations

When the recipient pubkey is known, clients SHOULD send room invitations as NIP-17 direct messages.

The unsigned NIP-17 rumor SHOULD be `kind:14` and include:

```json
{
  "kind": 14,
  "content": "MeshDrop room invitation",
  "tags": [
    ["p", "<recipient-pubkey>", "<recipient-dm-relay>"],
    ["a", "30382:<room-author-pubkey>:<room-id>", "<room-relay>"],
    ["client", "meshdrop"],
    ["subject", "<room display name>"],
    ["transport", "webrtc"],
    ["transport", "lan"],
    ["transport", "blossom"],
    ["transport", "fips"],
    ["room-secret", "<optional secret>"]
  ]
}
```

The `kind:14` `.content` field is plain text. Machine-readable invite fields SHOULD be tags on the encrypted rumor, not JSON
content, unless a future NIP defines a dedicated MeshDrop invite rumor kind.

The optional `room-secret` tag MUST only appear inside an encrypted NIP-17 rumor. Room secrets MUST NOT appear in unencrypted
public events.

## WebRTC signaling

This NIP does not define WebRTC signaling payloads. Clients SHOULD use a deployed WebRTC-over-Nostr signaling kind when
available. MeshDrop currently uses draft kind `25050` for WebRTC presence and signals.

When publishing WebRTC presence or signaling events, clients SHOULD set the signaling room tag to the room coordinate:

```text
30382:<room-author-pubkey>:<room-id>
```

This replaces instance-derived room strings such as `meshdrop:<host>`.

## Fetching rooms

To fetch a known room:

```json
{
  "kinds": [30382],
  "authors": ["<room-author-pubkey>"],
  "#d": ["<room-id>"],
  "limit": 1
}
```

Clients SHOULD query the author's NIP-65 write relays first, then relay hints from the `naddr`, then application defaults.

## Security considerations

Room definitions are public unless their relay access is separately restricted. Do not publish secrets, exact local network
addresses, or sensitive membership data in `kind:30382` events.

The `expiration` tag is a cleanup hint, not a secrecy guarantee. Relays and third parties may retain expired events.

Clients MUST validate event signatures and MUST treat room metadata as advisory. A room definition can advertise unsupported
or malicious relays and transports.

When a room is invite-only or private, authorization is enforced by clients and transfer protocols, not by this room definition
event. If relay-enforced admission is required, use NIP-29 instead.

## Compatibility

Clients that do not implement this NIP can still receive NIP-17 invitation text. They will not understand the room coordinate
or transport tags.

Clients MAY continue to support instance-native room IDs for local compatibility, but Nostr-native rooms SHOULD use the
`30382:<pubkey>:<d>` coordinate as their canonical room identifier.
