# NIP-TBD: MeshDrop FIPS and Pollen Discovery

`draft` `optional`

This NIP defines how MeshDrop servers discover FIPS and Pollen federation endpoints over Nostr. The discovery event is
ephemeral and carries only transport rendezvous metadata. MeshDrop peers still fetch `/.well-known/meshdrop-federation`
before trusting or relaying any peer state.

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
    ["d", "<npub-network id>"],
    ["network", "<npub-network id>"],
    ["server", "<meshdrop server id>"],
    ["room", "<npub-network id>"],
    ["p", "<optional target pubkey>"]
  ]
}
```

`d` is the primary indexed network selector. `network` duplicates the value for clients that do not index parameterized tags.
`p` tags are optional and allow targeted discovery for configured contacts.

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
runs MeshDrop; failed HTTP probes MUST be traceable but non-fatal.

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
  ["d", "<npub-network id>"],
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
  ["d", "<npub-network id>"],
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

MeshDrop clients SHOULD subscribe with both network-wide and targeted filters:

```json
[
  "REQ",
  "meshdrop-fed-<server-id>",
  {"kinds":[20385],"#d":["<npub-network id>"]},
  {"kinds":[20385],"#p":["<local pubkey>"]}
]
```

The `d` filter is the open same-network discovery path. The `p` filter preserves targeted discovery when operators configure
known npubs.

## Default network

When `MESHDROP_DISCOVERY_NPUBS` is empty, MeshDrop uses `npub-network:unconfigured`. That lets default MeshDrop servers see
public FIPS/Pollen announcements through a shared relay, but it MUST NOT be used for automatic Pollen invite issuance because
any relay listener could request admission. Operators who want automatic Pollen cluster bootstrap SHOULD configure
`MESHDROP_DISCOVERY_NPUBS` consistently on all participating instances.

## Receiver behavior

Receivers MUST ignore:

- events signed by their own server key;
- events whose `d` or `network` tag names another network;
- events without a `server` tag;
- FIPS events without a `base` tag;
- Pollen events without a `service` tag.
- Pollen service events whose `pln-root` differs from the receiver's local Pollen root.

After an event passes those checks, the receiver MUST verify the advertised MeshDrop federation descriptor over the advertised
transport before importing peers or relaying signaling.
