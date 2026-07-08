# 21-07 FIPS Route Reachability

## Symptom

A trusted Nostr FIPS announcement with only a MeshDrop `baseUrl` could create a usable-looking FIPS peer even when the browser or instance could not route to the advertised FIPS IPv6 host.

## Route Semantics

- `fips.yaml` peers are mesh bootstrap peers for connecting to the FIPS mesh.
- WOT-discovered FIPS peers are trusted WOT npubs advertising a FIPS npub and FIPS IPv6 address.
- Runtime FIPS peers are not derived from WOT npubs. A WOT author only supplies an advertised route identity that must match local FIPS daemon peer state.

## Cause

The federation path treated a FIPS `baseUrl` as enough proof that remote MeshDrop was routable. The stream recipient also tried direct browser fetches against FIPS IPv6 URLs even when the transfer descriptor was explicitly instance-relay shaped.

## Fix

- FIPS Nostr announcements now include advertised FIPS npub and FIPS IPv6 route identity.
- Federation verifies advertised route identity against local FIPS daemon peer state and remote `/fips/status` before registering peers or dispatching encrypted peer snapshots.
- Unverified FIPS announcements stay route candidates and fail closed as route-unavailable.
- Instance-relay FIPS stream descriptors download through the local backend proxy instead of requiring browser-routable FIPS IPv6.
- Docker compose no longer enables static public discovery rooms as a workaround.

## Verification

- `node --test test/federation-server.test.js test/fips-stream-server.test.js test/fips-stream-transfer.test.js` -> 54/54 pass.
- `npm test` -> 407/407 pass.
- `npm run test:fips-stream` -> instance relay FIPS stream fetched bytes with `hashMatched=true`, `fallback=false`.
- `npm run test:fips-mesh` -> shared-peer and different-peer FIPS mesh routes fetched bytes with `instanceRelay=true`, `hashMatched=true`, `fallback=false`.
- `npm run test:e2e` -> first refreshed run timed out in the Nostr WebRTC scenario; immediate rerun passed, including generic FIPS route candidates staying out of MeshDrop HTTP peer lists.
- `npm run test:docker` -> passed for `meshdrop:smoke`, image `sha256:10f7e92a1de1c1bb304cc38193cc7917669033791dddc1562a39a538138ee59b`.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> exit 0; AI Slop, Security, Linting, and Formatting clean. Remaining warnings are file-size warnings on existing large changed files.
- `npx --yes aislop scan .` -> exit 1 on pre-existing baseline: vendored noble cipher unused expressions/TODOs/empty function, oversized files, duplicate blocks, and `server/nostr-identity.js` hardcoded URL.
