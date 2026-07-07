# ADR 0010: Dockerized I2P Stream Proof

Date: 2026-07-08

Status: Accepted

## Context

Tor now has a Dockerized overlay stream proof, but issue #151 still tracked I2P and Loki because neither route had reproducible daemon/proxy byte evidence. MeshDrop already has generic overlay stream upload/download endpoints, so the I2P slice should avoid another route-specific storage path.

Public I2P bootstrap can be slow and environment-dependent. For a deterministic local proof, i2pd can run a local HTTP proxy plus HTTP server tunnel in Docker and expose a generated `.b32.i2p` destination.

## Decision

I2P byte-transfer proof uses a Dockerized i2pd runtime in the smoke harness:

- start i2pd with a local HTTP proxy and a MeshDrop HTTP server tunnel;
- use zero-hop local tunnels so the smoke proves i2pd proxy/server-tunnel data flow without depending on public I2P bootstrap timing;
- configure MeshDrop with the generated `.b32.i2p` stream endpoint;
- upload a short-lived payload through the generic overlay stream endpoint;
- fetch it back through the i2pd HTTP proxy;
- validate bytes, SHA-256, route type, primitive, WebRTC flag, instance-relay flag, and fallback status.

This is a non-WebRTC `i2p-http-stream` proof. It does not prove browser WebRTC over I2P, and it does not prove public I2P reachability beyond the local i2pd proxy/server-tunnel path.

## Consequences

- I2P can move from "no local daemon/proxy evidence" to a reproducible route-specific byte proof.
- Loki remains fail-closed until an equivalent daemon/proxy harness exists.
- Overlay stream upload/download logic remains shared by configured overlay adapters.
- Route-specific WebRTC overlay claims still require relay candidate proof under ADR 0007.

## Verification

- Focused route contract and smoke-script tests cover I2P route proof fields and the i2pd harness contract.
- `npm run test:i2p-stream` builds an i2pd test image, starts an HTTP proxy/server tunnel, fetches through the proxy, and emits `Proof i2p-http-stream`.
