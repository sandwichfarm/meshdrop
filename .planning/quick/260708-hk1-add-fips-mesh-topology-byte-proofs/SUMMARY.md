# Add FIPS Mesh Topology Byte Proofs Summary

Status: complete

## Changed

- Added `npm run test:fips-mesh` for shared-public-peer and different-public-peers FIPS mesh topologies.
- Extracted reusable Docker/FIPS smoke helpers from the direct FIPS stream proof.
- Kept `npm run test:fips-stream` direct A/B proof intact.
- Added static smoke-script assertions for the new package script, proof labels, direct A/B config guard, and topology evidence fields.

## Evidence

- `node --check scripts/fips-stream-smoke.mjs`
- `node --check scripts/fips-mesh-smoke.mjs`
- `node --check scripts/fips-smoke-support.mjs`
- `node --test test/docker-smoke-script.test.js` - 3/3 pass
- `npm run test:fips-stream` - direct FIPS proof passed with `hashMatched=true`, `fallback=false`, and positive endpoint `fips0` byte deltas
- `npm run test:fips-mesh` - both mesh proofs passed with `route=fips`, `primitive=fips-http-stream`, `hashMatched=true`, `fallback=false`, `directABConfig=false`
- `npm test` - 376/376 pass
- `git diff --check --cached`
- `npx --yes aislop scan --changes .` - clean

## Runtime Notes

- Shared public peer topology: A peers only P, B peers only P, P peers A and B. B fetches A by literal FIPS IPv6 URL. P has positive FIPS `forwarded_bytes`.
- Different public peers topology: A peers only P1, B peers only P2, P1 peers A/P2, P2 peers B/P1. B fetches A by literal FIPS IPv6 URL. P1 and P2 have positive FIPS `forwarded_bytes`.
- FIPS DNS identity seeding is enabled in the generated test configs because literal FIPS IPv6 outbound lookup needs the destination identity in the local cache without adding A/B as direct peers.
- Current FIPS daemon transit peers do not show positive local `fips0` byte deltas for forwarded traffic; transit proof uses FIPS routing `forwarded_bytes` counters.

## Remaining Risk

Real public internet FIPS peers beyond local Docker topology are not proven here.
