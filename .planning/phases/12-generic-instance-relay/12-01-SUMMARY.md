# Phase 12 Summary: Generic Instance Relay

## Result

Complete. MeshDrop now has a generic browser instance-relay protocol for descriptor construction, request validation, proof seed construction, and final route proof validation.

## Implemented

- Added `InstanceRelayTransferProtocol` for owner/session-bound `transportShape: "instance-relay"` descriptors.
- Centralized fail-closed validation for missing bindings, expired descriptors, primitive mismatch, WebRTC byte-path claims, fallback flags, missing instance-relay flags, byte mismatch, and hash mismatch.
- Moved Pollen instance-relay descriptor/proof behavior onto the generic protocol without changing the `pollenInstanceRelay` request shape.
- Loaded the generic helper after `route-contract.js` and before transfer protocols.
- Documented the boundary in ADR 0006: generic relay semantics only; no new transport support without route-specific byte proof.

## Verification

- `node --test test/instance-relay-transfer.test.js test/pollen-instance-relay.test.js test/pollen-transfer-protocol.test.js test/route-contract.test.js` -> 15/15 passing.
- `npm ci` -> lockfile dependencies installed; 0 vulnerabilities.
- `npm test` -> 344/344 passing.
- `npm run test:e2e` -> browser smoke passed, including federated Pollen instance relay with `webRtcUsed=false`, `instanceRelayed=true`, byte counts 285/285, and `hashMatched=true`.
- `npm run test:docker` -> Docker image rebuilt, container served runtime, browser transfer smoke passed, and two-host relay smoke passed.
- `git diff --cached --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.
- `npx --yes aislop scan .` -> baseline still fails outside this slice: noble-ciphers unused expressions/TODOs, large files/duplicates/long functions, and `server/nostr-identity.js` hardcoded URL warning.

## Remaining Work

- FIPS instance-to-instance relay still needs a route-specific byte-transfer slice using this generic contract.
- Tor, I2P, Loki, and TURN remain future adapters; none are claimed by this phase.
