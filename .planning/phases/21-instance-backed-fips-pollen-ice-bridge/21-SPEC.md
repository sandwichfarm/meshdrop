# Phase 21 SPEC: Instance-Backed FIPS/Pollen ICE Bridge

## Objective

Trusted peers that discover each other through Nostr WOT can select a FIPS or Pollen private route and create the first browser `RTCPeerConnection` with an instance-backed ICE bridge from the selected MeshDrop instance. Missing public/server federation advertisement is not a blocker. Missing instance ICE bridge config is a blocker when Clearnet is disabled.

## Acceptance

- Server runtime capabilities can advertise FIPS/Pollen ICE bridge descriptors whose source is `instance`.
- Client WOT route descriptors preserve trusted `iceBridge` metadata through encrypted route response handling.
- Route selection uses per-route descriptor bridge config before falling back to global route bridge config.
- FIPS/Pollen route setup with direct Clearnet disabled succeeds when trusted descriptor bridge config exists and creates `RTCPeerConnection` with `iceTransportPolicy: "relay"`.
- FIPS/Pollen route setup with direct Clearnet disabled fails closed with explicit `overlay-bridge-unavailable` when neither descriptor nor global bridge config exists.
- UI/status copy distinguishes WOT discovery/signaling, instance ICE bridge, and FIPS stream/Pollen storage transfer.
- Public discovery remains opt-in only; no solution path depends on `MESHDROP_PUBLIC_DISCOVERY=true`.

## Non-Goals

- Implementing a TURN daemon inside this repo.
- Proving FIPS stream or Pollen storage bytes as WebRTC bridge proof.
- Treating server-side trusted/public federation advertisement as required for private WOT route negotiation.
- Allowing silent Clearnet WebRTC fallback after FIPS/Pollen is selected.

## Required Proof

- Regression tests for WOT-private route metadata, absent public advertisement, descriptor-based ICE bridge config, and fail-closed no-bridge behavior.
- Executable smoke that creates a selected FIPS/Pollen route using descriptor bridge config and proves default Clearnet/STUN ICE config is not used.
