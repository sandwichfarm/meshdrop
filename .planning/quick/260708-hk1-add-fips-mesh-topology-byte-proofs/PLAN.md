---
status: complete
created: "2026-07-08"
completed: "2026-07-08T12:56:01+02:00"
---

# Add FIPS Mesh Topology Byte Proofs

## Goal

Prove FIPS HTTP stream bytes can route through intermediate/public FIPS peers, not only direct A/B peering.

## Plan

1. Keep `npm run test:fips-stream` direct A/B proof unchanged.
2. Add a focused FIPS mesh smoke harness for shared-public-peer and different-public-peers topologies.
3. Assert A and B never list each other as FIPS config peers in either mesh topology.
4. Emit required proof lines with hash match, fallback false, FIPS route/primitive, fips0 byte deltas for every container, and FIPS forwarding counters for transit containers.
5. Add package/test coverage for the new harness shape.

## Verification

- `node --check scripts/fips-stream-smoke.mjs`
- `node --check scripts/fips-mesh-smoke.mjs`
- `node --check scripts/fips-smoke-support.mjs`
- `node --test test/docker-smoke-script.test.js`
- `npm run test:fips-stream`
- `npm run test:fips-mesh`
- `npm test`
- `git diff --check --cached`
- `npx --yes aislop scan --changes .`

## Result

Complete. Direct FIPS stream proof still passes. Shared-public-peer and different-public-peers mesh proofs both transfer bytes over FIPS IPv6 with `route=fips`, `primitive=fips-http-stream`, `hashMatched=true`, and `fallback=false`.

A and B configs are asserted to exclude each other in both topologies. Transit peer `fips0` counters remain zero by current FIPS daemon design; the mesh proof records those counters and verifies transit with positive `forwarded_bytes` routing counters on P/P1/P2.
