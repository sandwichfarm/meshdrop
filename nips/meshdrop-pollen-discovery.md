# NIP-TBD: MeshDrop FIPS and Pollen Discovery

`draft` `optional`

This NIP defines how MeshDrop servers advertise explicit FIPS and Pollen federation endpoints over Nostr. Nostr identity and
the local web-of-trust are the discovery layer; FIPS and Pollen are route substrates. The discovery event is ephemeral and
carries only signed transport rendezvous metadata. MeshDrop peers fetch `/.well-known/meshdrop-federation` only after a
trusted Nostr author explicitly advertises a MeshDrop HTTP endpoint or Pollen service.

The provisional event kind is `20385`.

The kind was checked on July 6, 2026 against `relay.damus.io`, `relay.primal.net`, and `nos.lol` with an exact
`{"kinds":[20385],"limit":1}` subscription. All three relays returned EOSE with no events. Nearby candidate `20384` was
rejected because events existed on `relay.primal.net` and `nos.lol`.

## Event

```json
{
  "kind": 20385,
  "content": "",
  "tags": [
    ["type", "<fips-federation | pollen-federation | pollen-join-request | pollen-invite>"],
    ["protocol", "<protocol id>"],
    ["d", "<optional npub-network id for explicit public/debug discovery>"],
    ["network", "<optional npub-network id for explicit public/debug discovery>"],
    ["server", "<meshdrop server id>"],
    ["room", "<optional route room/debug id>"],
    ["p", "<optional target pubkey>"]
  ]
}
```

`d` is only used for an explicit public/lobby/debug discovery scope. `network` duplicates that value for clients that do not
index parameterized tags. The default discovery path is author trust: clients subscribe to events authored by trusted npubs
from the local follow list / configured trust set. `p` tags allow targeted discovery and Pollen bootstrap messages.

## FIPS discovery

FIPS discovery events MUST use:

```json
[
  ["type", "fips-federation"],
  ["protocol", "meshdrop-fips-nostr-discovery"],
  ["base", "http://[<fips-ipv6>]:<meshdrop-port>"]
]
```

Receivers fetch `/.well-known/meshdrop-federation` from `base`. A FIPS peer address alone is not proof that the remote node
runs MeshDrop, and receivers MUST NOT probe generic FIPS peers on port 3000. HTTP federation is attempted only for an
accepted signed Nostr event with an explicit `base` tag.

## Pollen discovery

Pollen discovery events MUST use:

```json
[
  ["type", "pollen-federation"],
  ["protocol", "meshdrop-pollen-nostr-discovery"],
  ["service", "<pollen service name>"],
  ["pln-node", "<pollen node id>"],
  ["pln-root", "<sha256 of the local Pollen root public key>"]
]
```

Receivers run `pln connect <service> <local-port>` and fetch `/.well-known/meshdrop-federation` through the local Pollen
tunnel only when the advertised `pln-root` matches their own Pollen root. A different `pln-root` means the service is from a
different Pollen cluster and cannot be reached by `pln connect`.

## Pollen cluster bootstrap

Pollen service discovery requires both servers to belong to the same Pollen cluster. If a MeshDrop instance has configured
discovery npubs and its Pollen node has no membership credentials yet, it MAY request a subject-bound invite instead of
starting a new single-node root cluster.

Join requests MUST use:

```json
[
  ["type", "pollen-join-request"],
  ["protocol", "meshdrop-pollen-nostr-discovery"],
  ["d", "<optional npub-network id for explicit public/debug discovery>"],
  ["p", "<configured peer pubkey>"],
  ["server", "<meshdrop server id>"],
  ["pln-node", "<joining pollen node id>"]
]
```

Peers MUST answer join requests only from configured discovery pubkeys. Invite responses MUST use:

```json
[
  ["type", "pollen-invite"],
  ["protocol", "meshdrop-pollen-nostr-discovery"],
  ["d", "<optional npub-network id for explicit public/debug discovery>"],
  ["p", "<joining nostr pubkey>"],
  ["server", "<meshdrop server id>"],
  ["pln-node", "<inviting pollen node id>"],
  ["pln-root", "<sha256 of the inviting Pollen root public key>"]
]
```

The invite event content MUST be NIP-44 encrypted to the joining Nostr pubkey and MUST contain a JSON object:

```json
{
  "token": "<pln invite --publisher --subject <joining-pollen-node-id> token>",
  "serverId": "<meshdrop server id>",
  "serviceName": "<pollen service name>",
  "rootHash": "<pln-root tag value>",
  "issuedAt": 1783380000
}
```

Receivers MUST NOT destructively purge an existing Pollen cluster to join a different cluster automatically.

## Subscription

MeshDrop clients SHOULD subscribe to their trusted author set and local-addressed events:

```json
[
  "REQ",
  "meshdrop-fed-<server-id>",
  {"kinds":[20385],"authors":["<trusted pubkey>", "..."]},
  {"kinds":[20385],"#p":["<local pubkey>"]}
]
```

When an operator explicitly enables public/lobby/debug discovery, clients MAY also subscribe with
`{"kinds":[20385],"#d":["npub-network:<id>"]}`. That filter MUST NOT be the default.

## Default network

By default, MeshDrop clients derive discovery rooms at runtime from the logged-in user's kind 3 follow list after loading
NIP-65 relay lists from bootstrap relays. Server/static npub configuration MUST NOT create default discovery rooms.
`npub-network:unconfigured` is reserved for explicit public/lobby/debug mode, for example when
`MESHDROP_PUBLIC_DISCOVERY=true` is configured. It MUST NOT be used as the default MeshDrop discovery model or for
automatic Pollen invite issuance.

## Receiver behavior

Receivers MUST ignore:

- events signed by their own server key;
- events from untrusted authors, unless an explicit public/lobby/debug discovery scope is enabled;
- events whose `d` or `network` tag names another network;
- events without a `server` tag;
- FIPS events without a `base` tag;
- Pollen events without a `service` tag.
- Pollen service events whose `pln-root` differs from the receiver's local Pollen root.

After an event passes those checks, the receiver MUST verify the advertised MeshDrop federation descriptor over the advertised
transport before importing peers or relaying signaling.
