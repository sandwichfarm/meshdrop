# Phase 13 Summary: FIPS Instance Relay

## Result

FIPS private transfers now attach generic `fipsInstanceRelay` metadata next to legacy `fipsStream`, and recipient proof prefers the relay metadata when present.

## Changed

- Added FIPS wrappers around `InstanceRelayTransferProtocol` for descriptor creation, proof seed creation, request validation, and proof finalization.
- Added shared private-route context extraction for FIPS stream and FIPS instance-relay metadata.
- Preserved legacy `fipsStream`-only download/proof behavior.
- Updated the FIPS two-instance smoke to validate a live generic FIPS relay proof with `instanceRelayed=true`.
- Added focused tests for relay descriptor/proof fields, fail-closed validation, modern recipient proof, and legacy fallback proof.

## Verification

```sh
npm ci
node --test test/fips-stream-transfer.test.js test/instance-relay-transfer.test.js test/pollen-instance-relay.test.js test/route-contract.test.js
npm run test:fips-stream
npm run test:e2e
npm run test:docker
npm test
git diff --check
npx --yes aislop scan --changes .
npx --yes aislop scan .
```

## Evidence

- Focused tests: 17/17 passed.
- FIPS runtime smoke: `Proof fips-instance-relay-route` reported route `fips`, primitive `fips-http-stream`, `webrtc=false`, `instanceRelay=true`, 43/43 bytes, `hashMatched=true`, `fallback=false`, and sender/recipient `fips0` byte deltas.
- Browser e2e smoke passed local, Blossom, Hashtree, Pollen, Nostr, generic FIPS route-candidate, and Pollen instance-relay proofs.
- Docker smoke passed with image `meshdrop:smoke`, local browser transfer proof, signed admin GUI proof, and two-host Nostr WebRTC proof.
- `npm test` passed 345/345.
- Changed-code slop scan was clean.

## Remaining Risk

- Full-repo slop scan still fails on baseline warnings outside this slice: noble library unused-expression warnings, large files, duplicate blocks, existing TODOs, `server/nostr-identity.js` hardcoded URL warning, and one empty noble utility function.
- Operator checkout remains dirty/stale and was not touched; exact testable path is this task worktree until PR merge/UAT handoff.
