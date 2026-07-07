# ADR 0011: Dockerized Loki Stream Proof

Date: 2026-07-08

Status: Accepted

## Context

Tor and I2P now have Dockerized overlay stream proofs, leaving Loki as the remaining route in issue #151 without reproducible daemon/proxy byte evidence. MeshDrop already has generic overlay stream upload/download endpoints, so the Loki slice should reuse that path and prove only the route-specific Lokinet dial surface.

Lokinet is network-layer software. The packaged daemon creates a local interface and DNS resolver, so running it with host networking would mutate the operator network namespace. For a deterministic proof, the smoke should keep Lokinet inside an isolated Docker container with NET_ADMIN and `/dev/net/tun`.

Oxen's Linux installation docs publish a Debian apt repo, and the SNApp docs describe `localhost.loki`, `127.3.2.1` DNS, keyfiles, and binding services to the Lokinet interface.

## Decision

Loki byte-transfer proof uses a Dockerized Lokinet runtime in the smoke harness:

- build a Node image with Lokinet from `deb.oxen.io`;
- run the container with `NET_ADMIN` and `/dev/net/tun` so Lokinet can create `lokitun0`;
- configure a persistent Lokinet keyfile, `ifaddr=10.67.0.1/16`, and DNS on `127.3.2.1:53`;
- run MeshDrop inside that same container so the proof does not touch host routing;
- resolve `localhost.loki` to a generated `.loki` destination;
- configure MeshDrop with the generated `.loki` stream endpoint;
- upload a short-lived payload through the generic overlay stream endpoint;
- fetch it back through a plain `.loki` URL using the Lokinet resolver;
- validate bytes, SHA-256, route type, primitive, WebRTC flag, instance-relay flag, and fallback status.

This is a non-WebRTC `loki-http-stream` proof. It does not prove browser WebRTC over Loki, and it does not prove public Lokinet reachability beyond the local daemon/SNApp path.

## Consequences

- Loki can move from "no local daemon/proxy evidence" to a reproducible route-specific byte proof.
- Issue #151 can close after this branch lands because Tor, I2P, and Loki all have daemon/proxy byte-transfer proof.
- The proof avoids host network mutation by running MeshDrop and Lokinet inside the same container.
- Overlay stream upload/download logic remains shared by configured overlay adapters.
- Route-specific WebRTC overlay claims still require relay candidate proof under ADR 0007.

## Verification

- Focused route contract and smoke-script tests cover Loki route proof fields and the Lokinet harness contract.
- `npm run test:loki-stream` builds a Lokinet test image, starts Lokinet with a `.loki` SNApp address, fetches through plain `.loki` DNS resolution, and emits `Proof loki-http-stream`.
