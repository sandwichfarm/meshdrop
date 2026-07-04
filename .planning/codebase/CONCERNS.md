# Codebase Concerns

**Analysis Date:** 2026-07-04

## Tech Debt

**PairDrop inheritance still dominates docs and naming:**
- Issue: Top-level README and many class names still say PairDrop even though the active product direction is MeshDrop.
- Files: `README.md`, `server/server.js`, `server/ws-server.js`, `public/scripts/main.js`, docs under `docs/`.
- Why: MeshDrop is a brownfield fork/evolution of PairDrop.
- Impact: New agents can mis-prioritize upstream PairDrop behavior over MeshDrop multi-network direction.
- Fix approach: Create a phased rebrand/docs pass after core runtime behavior is stabilized.

**No bundler or typed module boundary:**
- Issue: Browser scripts are loaded globally and depend on load order from `public/scripts/main.js`.
- Files: `public/scripts/main.js`, `public/scripts/*.js`.
- Why: Legacy no-build PWA architecture.
- Impact: New browser protocol code can silently rely on globals or break deferred load ordering.
- Fix approach: Keep additions small, add protocol tests, and consider a later module-boundary cleanup only with regression coverage.

**Large stateful WebSocket server:**
- Issue: `server/ws-server.js` owns room state, pairing, public rooms, FIPS/Pollen joins, keepalive, signal relay, fallback relay, and federation projection.
- Why: Feature growth accumulated around the original signaling server.
- Impact: Room changes can affect unrelated transfer paths.
- Fix approach: Add regression tests before touching room membership or message routing; extract helpers only when behavior is pinned.

**Runtime config spread across env, compose, and client `/config`:**
- Issue: Transport enablement flows through `server/index.js`, `server/server.js`, Docker env, browser scripts, and tests.
- Why: Multiple optional transports share the same browser UX.
- Impact: A config change can make UI advertise a transport that the server cannot serve.
- Fix approach: Treat `/config` plus runtime status endpoints as acceptance surfaces for transport changes.

## Known Bugs

**None confirmed in this mapping pass.**
- This document records areas of risk, not verified defects.
- Do not treat a concern as a bug without reproduction or failing test evidence.

## Security Considerations

**Debug mode can expose sensitive runtime context:**
- Risk: `server/index.js` logs the full config object in `DEBUG_MODE`.
- Current mitigation: compose sets `DEBUG_MODE=false`.
- Recommendations: Keep debug off in production and avoid adding secrets to `conf`.

**FIPS peer settings endpoint mutates network peer connections:**
- Risk: `POST /settings/fips/peers` accepts peer settings and calls FIPS connect/restart actions.
- Current mitigation: input normalization, max 32 peers, string length caps, transport allowlist.
- Recommendations: Revisit auth/origin protections before exposing this service beyond trusted local networks.

**Federation accepts remote events after server verification heuristics:**
- Risk: bad federation inputs can project remote peers/signals into local rooms if verification is weakened.
- Current mitigation: remote sender verification through known server descriptors, transport matching, server ID checks, and discovery before accepting unknown senders.
- Recommendations: Add focused tests for any changes to `receiveEvents`, `_verifyAndRegisterSender`, and `_dispatchEvent`.

**Storage-backed transfers need descriptor integrity:**
- Risk: Blossom/Pollen/Hashtree paths can fetch remote or local storage-backed payloads.
- Current mitigation: Blossom and Hashtree protocol tests cover hash/tamper and encryption failure cases; Pollen hashes are validated as 64 hex characters.
- Recommendations: Keep cryptographic and descriptor validation tests mandatory for transfer changes.

**Nostr identity affects peer IDs:**
- Risk: accepting invalid identity could let a user claim another peer's identity.
- Current mitigation: `server/nostr-identity.js` verifies event signature, kind/content, display name bounds, and clock skew.
- Recommendations: Add tests before changing identity event shape or clock-skew policy.

## Performance Bottlenecks

**In-memory room scans:**
- Problem: room notifications iterate objects in `server/ws-server.js`.
- Measurement: no production numbers in repo.
- Cause: simple object maps are fine for small rooms but not optimized for very large public rooms.
- Improvement path: collect runtime room-size evidence before optimizing.

**Federation polling:**
- Problem: `MeshFederation` polls FIPS/Pollen discovery every `MESHDROP_FEDERATION_POLL_MS` with default 15000ms.
- Measurement: no production numbers in repo.
- Cause: polling plus relay sockets plus HTTP discovery can become noisy with many peers.
- Improvement path: prefer FIPS event listener and targeted tests before reducing polling intervals.

**Pollen upload/download shell-outs:**
- Problem: each upload/download runs or interacts with `pln` commands and streams data through the Node process.
- Measurement: no benchmark in repo.
- Cause: adapter architecture shells out instead of linking a library.
- Improvement path: preserve streaming and size guards; benchmark before changing.

## Fragile Areas

**Room priority and transport selection:**
- Why fragile: client picks among `ip`, `fips`, `pollen`, `secret`, `public-id`, and `nostr` rooms.
- Common failures: wrong room wins, peer duplicate/left events, or visible actions appear for unavailable transports.
- Safe modification: run focused tests such as `test/signaling-room-priority.test.js`, `test/peer-availability-protocol.test.js`, and relevant discovery tests.
- Test coverage: good targeted coverage exists, but runtime browser smoke may still be needed.

**Service worker versioning:**
- Why fragile: stale assets can hide browser code changes.
- Common failures: tests pass against source but browser serves cached old scripts.
- Safe modification: run `npm run build:service-worker` when touching `public/service-worker.js` or cached asset behavior.
- Test coverage: `test/service-worker-version.test.js`.

**Docker/FIPS/Pollen deployment:**
- Why fragile: depends on host binaries, capabilities, tun device, mounted config, UDP/TCP ports, and state volumes.
- Common failures: container healthy but transport daemon unavailable, port mismatch, missing host binary.
- Safe modification: run `npm run test:docker` or explicit compose smoke for service/port changes.
- Test coverage: script exists; full runtime proof is still environment-dependent.

**Browser crypto fallback:**
- Why fragile: must work both with and without `crypto.subtle`.
- Common failures: fallback decrypt accepts tampered data or fails in older browser paths.
- Safe modification: run Blossom/Hashtree transfer protocol tests after crypto or transfer descriptor changes.
- Test coverage: strong focused tests in `test/blossom-transfer-protocol.test.js` and `test/hashtree-transfer-protocol.test.js`.

## Scaling Limits

**No durable room store:**
- Current capacity: single process memory.
- Limit: process restart loses room state, pair keys, federation remote server cache, and keepalive timers.
- Symptoms at limit: peers disconnect/rejoin; active transfers may need renegotiation.
- Scaling path: keep single-node semantics for now or design explicit shared room state before horizontal scaling.

**No account/auth layer:**
- Current capacity: trusted self-host/local network assumptions.
- Limit: admin-like FIPS settings endpoint and public rooms should not be treated as Internet-hardened admin surfaces.
- Symptoms at limit: unwanted peer configuration or abuse if exposed without reverse-proxy controls.
- Scaling path: define auth and deployment boundary before exposing mutating settings broadly.

## Dependencies at Risk

**Node engine is loose:**
- Risk: `package.json` allows Node >=15, but current APIs such as `fetch`, `AbortSignal.timeout`, and Web Crypto assumptions are more reliable on newer Node versions.
- Impact: older supported Node versions may fail at runtime.
- Migration plan: verify actual minimum Node version and update `engines.node` if needed.

**Vendored browser libraries:**
- Risk: minified libraries under `public/scripts/libs/` are not managed by npm.
- Impact: security updates and provenance are manual.
- Migration plan: document versions and update process before major browser dependency work.

## Missing Critical Features

**MeshDrop-specific product docs:**
- Problem: README still describes PairDrop more than MeshDrop's multi-network direction.
- Current workaround: AGENTS and `.planning` capture local intent.
- Blocks: onboarding, roadmap clarity, user-facing claims.
- Implementation complexity: medium docs/UI pass.

**Current GSD project plan:**
- Problem: before this workflow, `.planning/PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` did not exist.
- Current workaround: codebase map plus user brief.
- Blocks: structured phase planning.
- Implementation complexity: handled by `$gsd-new-project` after map completion.

## Test Coverage Gaps

**Full browser runtime across all transports:**
- What's not tested: complete UX from discovery to transfer over each transport in real browsers.
- Risk: protocol-level tests pass but UI wiring or browser cache/load order fails.
- Priority: high for user-facing transfer changes.
- Difficulty to test: needs browser automation plus optional FIPS/Pollen services.

**Live FIPS/Pollen service health:**
- What's not tested: real daemon behavior under local compose for every change.
- Risk: adapter tests pass but host binary/socket/port setup fails.
- Priority: high for deployment/transport changes.
- Difficulty to test: depends on host services, device permissions, and network ports.

**Federation at multi-node scale:**
- What's not tested: multiple real servers discovering and relaying signals over FIPS/Pollen/Nostr simultaneously.
- Risk: event loops, duplicate peers, stale remote server state, or relay failures under churn.
- Priority: medium-high for federation changes.
- Difficulty to test: requires multi-process or multi-container setup.

---
*Concerns audit: 2026-07-04*
*Update as issues are fixed or new ones discovered*
