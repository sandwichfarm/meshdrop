# ADR 0007: TURN Relay Proof Before Overlay WebRTC Claims

Date: 2026-07-07

Status: Accepted

## Context

MeshDrop can discover and negotiate private routes over Nostr, FIPS, and Pollen, and it can transfer bytes over direct WebRTC, Pollen object paths, FIPS stream, and instance-relay paths. Browser WebRTC over an overlay is different: SDP and route descriptors are not proof that file bytes used the overlay. The selected ICE candidate pair must be constrained to the intended relay path.

The repository already has relay ICE configuration hooks for FIPS and Pollen plus old coturn example files, but no runtime smoke proves that a browser transfer used a relay candidate instead of silently falling back to host, server-reflexive, or peer-reflexive Clearnet candidates.

## Decision

Before labeling FIPS, Pollen, Tor, I2P, or Loki as WebRTC byte transports, MeshDrop must have a generic TURN relay proof harness.

The proof must:

- configure WebRTC with `iceTransportPolicy: "relay"`;
- transfer an actual file payload between browser peers;
- read WebRTC stats for the selected candidate pair;
- assert the local and remote candidate types are `relay`;
- report sender runtime, recipient runtime, selected route type, data-plane primitive, WebRTC use, instance relay flag, byte counts, hash match, and fallback status.

Route-specific overlay WebRTC claims still require additional proof that the TURN endpoint itself is reachable through that named overlay. Generic TURN relay proof only proves the browser can be constrained to a relay data path.

## Consequences

- FIPS/Pollen relay ICE remains unavailable without explicit relay config.
- Tor/I2P/Loki remain fail-closed until a local daemon/proxy dial surface and route-specific byte proof exist.
- The e2e suite can distinguish discovery/signaling proof from WebRTC byte-path proof.
- Direct Nostr WebRTC and same-instance WebRTC remain valid routes; this ADR only governs claims that an overlay carried WebRTC bytes.

## Verification

- Focused tests cover proof extraction and fail-closed relay policy.
- A local coturn-backed smoke proves relay-only WebRTC transfer and selected candidate type `relay`.
- Existing browser and Docker transfer smokes continue to pass.
