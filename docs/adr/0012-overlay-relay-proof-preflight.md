# ADR 0012: Overlay Relay Proof Preflight

Date: 2026-07-08

Status: Accepted

## Context

MeshDrop now has a generic TURN relay smoke that proves browser WebRTC can be forced through a selected ICE candidate of type `relay`. That proof is necessary but not enough for FIPS/Pollen overlay WebRTC claims. A TURN server on ordinary Clearnet can still produce a relay candidate, so relabeling generic TURN proof as FIPS or Pollen would be false.

Issue #152 tracks the remaining runtime blocker: a relay endpoint must be reachable through the named overlay, then browser transfer proof must show selected relay candidates, verified bytes, and no Clearnet fallback.

## Decision

Overlay `webrtc-relay-ice` route proofs for FIPS, Pollen, Tor, I2P, and Loki must include topology evidence that:

- names the same overlay as the route type;
- names the relay endpoint used by the route-specific RTC config;
- accompanies normal route proof fields: sender/recipient runtime, primitive, WebRTC flag, instance relay flag, byte counts, hash match, fallback status, and selected ICE candidate type.

MeshDrop also provides an opt-in preflight command that validates route-specific relay ICE config and topology evidence before runtime UAT. The preflight explicitly reports `provenTransfer=false`; it is readiness evidence only, not byte-transfer proof.

## Consequences

- Generic `turn-relay` proof remains valid for the generic relay route.
- FIPS/Pollen WebRTC overlay proof cannot pass from relay ICE stats alone.
- Missing relay config or missing topology evidence fails closed with issue #152 still naming the blocked runtime work.
- Future Tor/I2P/Loki WebRTC relay claims inherit the same topology guard.

## Verification

- Route contract tests reject overlay relay proofs without topology evidence.
- Preflight tests reject missing relay ICE config, missing topology evidence, mismatched overlay names, and mismatched relay endpoints.
- Configured preflight proof can pass without claiming bytes moved.
