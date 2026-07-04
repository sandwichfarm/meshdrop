# Testing Patterns

**Analysis Date:** 2026-07-04

## Test Framework

**Runner:**
- Node built-in test runner through `node --test`.
- Tests live under `test/*.test.js`.

**Assertion Library:**
- Node built-in `assert` module.
- Common imports include `import test from "node:test";` and `import assert from "node:assert/strict";`.

**Run Commands:**
```bash
npm test                         # Run all Node tests
npm run test:e2e                 # Run browser/user-flow smoke runner
npm run test:docker              # Run Docker/container smoke runner
npm run build:service-worker     # Update/check service worker cache version behavior
```

## Test File Organization

**Location:**
- All committed tests are in the top-level `test/` directory.
- There are no colocated tests under `server/` or `public/`.

**Naming:**
- Protocol tests: `test/*-protocol.test.js`.
- Server/adapter tests: `test/*-server.test.js`, `test/fips-control.test.js`, `test/nostr-identity.test.js`.
- UI visibility/copy tests: `test/action-visibility.test.js`, `test/header-copy.test.js`, `test/footer-discovery-protocol.test.js`.

**Current suites:**
```text
test/
|-- action-visibility.test.js
|-- blossom-key-delivery.test.js
|-- blossom-transfer-protocol.test.js
|-- federation-server.test.js
|-- fips-control.test.js
|-- fips-discovery-protocol.test.js
|-- footer-discovery-protocol.test.js
|-- hashtree-transfer-protocol.test.js
|-- header-copy.test.js
|-- local-discovery-protocol.test.js
|-- nostr-discovery-protocol.test.js
|-- nostr-identity.test.js
|-- nostr-mesh-protocol.test.js
|-- peer-availability-protocol.test.js
|-- pollen-transfer-protocol.test.js
|-- pollen-transfer-server.test.js
|-- rtc-peer-signaling.test.js
|-- service-worker-version.test.js
|-- signaling-room-priority.test.js
`-- ws-room.test.js
```

## Test Structure

**Suite Organization:**
```javascript
import test from "node:test";
import assert from "node:assert/strict";

test("feature does expected behavior", async () => {
    const result = await exerciseFeature();
    assert.equal(result.value, "expected");
});
```

**Patterns:**
- Tests are mostly flat `test("description", ...)` calls.
- Browser protocol tests load scripts into a simulated/global environment and assert exposed `globalThis` objects.
- Server tests instantiate classes or object-shaped fakes instead of running the full service unless the behavior needs network proof.
- Cleanup is usually explicit with `try/finally`, local helper cleanup functions, or process/socket close calls.

## Mocking

**Framework:**
- No Jest/Vitest-style mocking framework.
- Tests use hand-written fakes, monkey-patching, `globalThis` replacement, and local fake servers/processes.

**Patterns:**
```javascript
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(blob);
try {
    // exercise browser protocol
} finally {
    globalThis.fetch = originalFetch;
}
```

**What to Mock:**
- Browser globals such as `fetch`, `crypto.subtle`, storage, and WebSocket-like objects.
- External binaries such as `pln` through fake executable scripts or controlled process behavior.
- FIPS control socket responses through test TCP servers or direct client fakes.

**What NOT to Mock:**
- Protocol validation and crypto/hash checks when the test can exercise real implementation.
- Core WebSocket room behavior when a direct class-level test can cover it.

## Fixtures and Factories

**Test Data:**
- Factories are local to test files, for example fake peers in `test/federation-server.test.js`.
- Browser protocol tests create descriptors, headers, blobs, and encrypted fixtures in helper functions inside the same file.

**Location:**
- No shared `fixtures/` directory exists.
- Keep fixtures near the test until duplication justifies extraction.

## Coverage

**Requirements:**
- No numeric coverage target was found.
- CI workflows do not run a coverage command.

**Configuration:**
- No coverage configuration was found.

**View Coverage:**
- Not currently configured.

## Test Types

**Unit tests:**
- Scope: module-level behavior for adapters, protocol helpers, identity verification, service worker versioning, room priority.
- Command: `npm test`.

**Integration tests:**
- Scope: WebSocket room behavior, federation event bridging, FIPS/Pollen adapter behavior.
- Command: `npm test`.

**E2E tests:**
- Scope: browser/user-flow smoke.
- Command: `npm run test:e2e`.
- Runner implementation: `scripts/e2e-smoke.mjs`.

**Docker tests:**
- Scope: compose/container build and service boot.
- Command: `npm run test:docker`.
- Runner implementation: `scripts/docker-smoke.mjs`.

## Common Patterns

**Async Testing:**
```javascript
test("operation returns expected status", async () => {
    const status = await client.status();
    assert.equal(status.available, true);
});
```

**Error Testing:**
```javascript
await assert.rejects(
    () => client.fetchToTemp("not-a-hash"),
    /Invalid Pollen blob hash/
);
```

**Browser Script Testing:**
- Load or evaluate browser script in a controlled global environment.
- Assert protocol objects exposed on `globalThis`.
- Restore globals in `finally`.

**Runtime Proof:**
- For browser/user-flow changes, run `npm run test:e2e`.
- For Docker, compose, service boot, published ports, FIPS, or Pollen service shape, run `npm run test:docker` or explicit compose smoke.
- For service worker cache/version behavior, run `npm run build:service-worker` and the focused service worker tests.

---
*Testing analysis: 2026-07-04*
*Update when test patterns change*
