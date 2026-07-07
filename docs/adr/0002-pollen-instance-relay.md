# ADR 0002: Pollen Instance Relay Proof

Date: 2026-07-07

Status: Accepted

## Context

MeshDrop needed one backend-mediated data-plane proof before extending the route contract to more transports. Pollen already has browser-facing upload/download endpoints backed by the local instance and Pollen object substrate, so it is the shortest path to prove encrypted bytes can cross two MeshDrop instances without calling discovery or signaling a transfer proof.

## Decision

Use the existing Pollen object upload/download primitive as the first instance relay data plane.

For Nostr-bound Pollen federation peers, the sender browser encrypts file bytes locally, uploads only ciphertext to its local instance, and sends a v1 route descriptor with `routeType: "pollen"`, `transportShape: "instance-relay"`, and `endpoint.primitive: "pollen-object-store"`. The descriptor is bound to the sender pubkey and transfer session. The content key is wrapped with NIP-44 so the proof does not rely on the WebRTC data channel for payload key delivery.

The recipient instance retrieves ciphertext by descriptor, the recipient browser decrypts locally, verifies the original SHA-256 hash, and emits route proof with sender/recipient runtimes, primitive, byte counts, hash status, WebRTC byte-path status, instance-relay status, and fallback status.

Local same-instance Pollen storage stays compatible but does not claim instance-relay proof metadata.

## Consequences

- Instances and Pollen see ciphertext, descriptor metadata, hashes, sizes, and route/session binding; they do not see plaintext file bytes.
- The selected proof is scoped to file bytes. Pollen can still be used for discovery/signaling separately.
- Missing owner/session binding, expired descriptors, hash mismatch, missing runtime, or fallback attempts fail closed.
- This stays Pollen-specific until a later slice generalizes the instance relay adapter for FIPS and other backends.

## Verification

- `node --test test/pollen-instance-relay.test.js test/pollen-transfer-protocol.test.js test/route-contract.test.js test/blossom-key-delivery.test.js`
- `npm run test:e2e`
