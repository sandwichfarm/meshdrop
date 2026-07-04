# MeshDrop for StartOS

MeshDrop shares files between peers over negotiated transports. This package source targets StartOS and runs the
server-backed MeshDrop image with runtime feature negotiation.

## Current State

- Package source scaffold exists.
- Generated source typechecks against `@start9labs/start-sdk@1.5.3`.
- The package includes the StartOS `s9pk.mk` make plumbing and `make` reaches `start-cli s9pk pack`.
- The package points at the `__MESHDROP_IMAGE__` image.
- The package exposes the web UI on port 3000.
- Pollen is enabled by default for backend-capable transfer testing.
- FIPS is disabled by default until a StartOS-specific FIPS binary and device-network path are tested.

## Not Complete

- `.s9pk` build proof with `start-cli` is still required.
- StartOS device install UAT is still required.
- WebRTC and Pollen transfer UAT from a StartOS device are still required.
