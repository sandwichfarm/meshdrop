# ADR 0001: Route Adapter Contract

Date: 2026-07-07

Status: Accepted

## Context

MeshDrop already discovers peers through local rooms, Nostr, FIPS/Pollen route rooms, and federation surfaces. It also transfers files through WebRTC, local WebSocket fallback, Blossom, Hashtree, and Pollen upload/download surfaces.

Discovery and signaling are not enough to claim a transport moved file bytes. FIPS npubs, Pollen service identities, and user Nostr npubs are also different identities and must not be collapsed into one stable public topology.

## Decision

MeshDrop treats Nostr as the authenticated control plane for identity, social-graph trust, signaling, and private route descriptor exchange.

MeshDrop treats each data path as a route adapter. A route adapter must expose status, capabilities, descriptor creation, descriptor acceptance, send or stream primitives, receive primitives, close behavior, and route proof.

Route descriptors are short-lived, session-bound, and owner-bound. Transport-specific endpoint metadata stays opaque to the generic contract and is validated by the adapter that owns that transport.

Legacy FIPS/Pollen room descriptors remain valid as a compatibility shape while the live route manager is still room-first. They are represented as legacy instance-relay descriptors and inherit owner/session trust from the encrypted Nostr envelope that carried them.

A route may claim transfer support only when proof records sender runtime, recipient runtime, selected route type, data-plane primitive, WebRTC use, instance relay use, bytes sent, bytes received, content hash match, and whether fallback occurred.

## Consequences

- Future FIPS, Pollen, instance relay, native, Tor, I2P, Loki, and TURN work can attach as adapters instead of new route architectures.
- UI can explain unavailable, candidate, selected, failed, and fallback states from machine-readable scoring and proof reasons.
- SPA and native targets can fail closed when a backend-only or native-only adapter is unavailable.
- Slice 1 does not change live route selection or claim new byte transport support.

## Verification

- `test/route-contract.test.js` pins descriptor validation, legacy room descriptor representation, adapter availability terms, candidate scoring, and route proof fields.
- Existing Nostr mesh, signaling priority, and Pollen protocol tests remain the guard for current room-based behavior.
