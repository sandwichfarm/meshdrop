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
    ["type", "<fips-federation | pollen-federation>"],
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
  ["service", "<pollen service name>"]
]
```

Receivers run `pln connect <service> <local-port>` and fetch `/.well-known/meshdrop-federation` through the local Pollen
tunnel.

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

When `MESHDROP_DISCOVERY_NPUBS` is empty, MeshDrop uses `npub-network:unconfigured`. That lets two default MeshDrop servers
find each other through a shared relay without pre-sharing npubs. Operators who want a smaller discovery set SHOULD configure
`MESHDROP_DISCOVERY_NPUBS` consistently on all participating instances.

## Receiver behavior

Receivers MUST ignore:

- events signed by their own server key;
- events whose `d` or `network` tag names another network;
- events without a `server` tag;
- FIPS events without a `base` tag;
- Pollen events without a `service` tag.

After an event passes those checks, the receiver MUST verify the advertised MeshDrop federation descriptor over the advertised
transport before importing peers or relaying signaling.
