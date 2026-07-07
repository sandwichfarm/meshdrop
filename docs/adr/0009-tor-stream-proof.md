# ADR 0009: Dockerized Tor Stream Proof

Date: 2026-07-07

Status: Accepted

## Context

Tor, I2P, and Loki were previously represented as fail-closed overlay stream capabilities because the repo had no reproducible local daemon or proxy proof. Issue #151 tracks that gap. Host-installed Tor was not a dependable prerequisite, and route labels still require byte-path evidence rather than configured endpoint metadata.

MeshDrop already has a generic overlay adapter catalog and FIPS/Pollen proof patterns. The next useful slice is the smallest route-specific overlay proof that can bring its own daemon surface.

## Decision

Tor byte-transfer proof uses a Dockerized Tor runtime in the smoke harness:

- start Tor with a hidden service mapped to the local MeshDrop server;
- configure MeshDrop with the generated `.onion` stream endpoint;
- upload a short-lived payload through the generic overlay stream endpoint;
- fetch it back through Tor SOCKS with remote hostname resolution;
- validate bytes, SHA-256, route type, primitive, WebRTC flag, instance-relay flag, and fallback status.

This is a non-WebRTC `tor-http-stream` proof. It does not prove browser WebRTC over Tor, and it does not prove I2P or Loki.

## Consequences

- Tor can move from "no local daemon/proxy evidence" to a reproducible route-specific byte proof.
- I2P and Loki remain fail-closed until equivalent daemon/proxy harnesses exist.
- Overlay stream upload/download logic is shared by configured overlay adapters instead of hard-coding Tor-only storage behavior.
- Route-specific WebRTC overlay claims still require relay candidate proof under ADR 0007.

## Verification

- Focused overlay stream and route contract tests cover token-bound downloads, unavailable-route failures, route proof fields, and Tor descriptor behavior.
- `npm run test:tor-stream` builds a Tor test image, starts a hidden service, fetches through SOCKS, and emits `Proof tor-http-stream`.
