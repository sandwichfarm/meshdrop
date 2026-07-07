# ADR 0006: Generic Instance Relay Contract

Date: 2026-07-07

Status: Accepted

## Context

Pollen instance relay proved that MeshDrop can move encrypted payload bytes through an instance-mediated backend route while keeping plaintext in the browser. FIPS stream proof separately proved encrypted bytes over the FIPS mesh IPv6 data plane.

The next route families, including FIPS instance relay, Tor, I2P, and Loki, need the same short-lived descriptor, owner/session binding, proof seed, fail-closed validation, and route proof semantics. Keeping that logic inside `PollenTransferProtocol` would force every new backend to re-implement the same proof rules.

## Decision

Introduce a generic browser instance-relay protocol for `transportShape: "instance-relay"` descriptors and proof finalization.

Transport-specific adapters still own endpoint fields, upload/download behavior, and runtime proof. The generic protocol owns the invariant parts:

- owner pubkey binding;
- transfer session binding;
- descriptor expiry;
- endpoint primitive presence;
- encrypted/private/fail-closed constraints;
- `capabilities.webRtcDataPath=false`;
- `capabilities.instanceRelay=true`;
- proof seed and final route proof fields;
- rejection of fallback or WebRTC byte-path claims.

Pollen remains the first concrete adapter using this contract. New FIPS/Tor/I2P/Loki support may reuse the generic protocol, but cannot be exposed as transfer support until a route-specific runtime proof shows encrypted bytes moved over that backend.

## Consequences

- Pollen's public `pollenInstanceRelay` request shape remains stable while its descriptor/proof logic moves behind a shared contract.
- Future backend adapters can focus on endpoint validation and byte movement instead of duplicating route proof semantics.
- A route descriptor still is not proof. Transfer support remains incomplete until byte counts and hash verification produce a route proof.

## Verification

- Generic instance-relay focused tests must cover descriptor construction, proof finalization, and fail-closed validation.
- Existing Pollen instance-relay tests must pass unchanged for observable request/proof behavior.
