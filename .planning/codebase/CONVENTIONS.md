# Coding Conventions

**Analysis Date:** 2026-07-04

## Naming Patterns

**Files:**
- Server and browser modules generally use kebab-case: `ws-server.js`, `fips-control.js`, `pollen-transfer.js`, `nostr-mesh.js`.
- Tests use `*.test.js` under `test/`.
- Root project documents use uppercase names: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`.

**Functions and methods:**
- camelCase for functions and methods.
- Private/internal class methods use a leading underscore, for example `_onMessage`, `_joinRoom`, `_discoverHttpServer`, `_uploadSizeGuard`.
- Event handlers often start with `_on`, for example `_onJoinFipsRoom` and `_onNostrRelayMessage`.
- Factory/config helpers use `create*Config`, for example `createFipsConfig`, `createPollenConfig`, and `createFederationConfig`.

**Variables:**
- camelCase for variables and object properties.
- Constants use `UPPER_SNAKE_CASE`, for example `DEFAULT_FIPS_ROOM`, `FEDERATION_KIND`, `SERVICE_PREFIX`.
- Message `type` values use kebab-case strings, for example `join-fips-room`, `peer-joined`, and `pollen-request`.

**Classes:**
- PascalCase class names: `PairDropServer`, `PairDropWsServer`, `Peer`, `FipsControlClient`, `PollenTransferClient`, `MeshFederation`.
- Default exports are common for primary classes; named exports are used for constants and config factories.

## Code Style

**Formatting:**
- Four-space indentation in server and browser JavaScript.
- Semicolons are inconsistent: many statements omit them, imports and object literals often use them. Match the surrounding file.
- Both double and single quotes exist. Server modules added recently tend to use double quotes; older PairDrop code often uses single quotes. Match the touched file.
- Braces are usually K&R style.

**Linting:**
- No ESLint, Prettier, Biome, or TypeScript config was found.
- Use `git diff --check` as a whitespace gate.
- Use tests and focused review instead of relying on a formatter.

## Import Organization

**Order:**
1. Node built-ins and external packages.
2. Blank line.
3. Relative project imports.

**Examples:**
- `server/index.js` imports `child_process` and `fs`, then relative server modules.
- `server/server.js` imports Express/rate-limit and Node built-ins together.

**Path Aliases:**
- No path aliases were found.
- Use relative imports such as `./peer.js` and `./federation.js`.

## Error Handling

**Patterns:**
- Server startup validates incompatible config and exits with `process.exit(1)`.
- Optional transport adapters generally return status objects instead of throwing from status checks.
- Route handlers catch adapter errors and send `502` JSON with `error.message`.
- Federation polling catches/logs failures and continues.
- WebSocket message parsing catches malformed JSON and returns without closing the socket.

**Error Types:**
- Custom Error subclasses are not used.
- Errors are plain `Error` instances with human-readable messages.
- Adapter failures usually include upstream stderr when available.

## Logging

**Framework:**
- Console logging only.
- Levels in use: `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug`.

**Patterns:**
- Debug-only config and peer IP details are guarded by `DEBUG_MODE`.
- Federation transport failures are logged as warnings.
- Browser startup logs initialization and asset loading stages.

## Comments

**When to Comment:**
- Comments explain protocol choices, deployment behavior, and older browser/runtime constraints.
- Many legacy comments describe straightforward behavior; avoid adding more of that.
- Prefer clearer code or focused tests over explanatory comments when changing behavior.

**TODO Comments:**
- No consistent TODO ownership pattern was found.
- If a TODO is unavoidable, include an issue or phase reference.

## Function Design

**Size:**
- Several core methods are large by current standards, especially WebSocket message handling and route setup.
- New code should use small helpers when it reduces branching in `server/ws-server.js`, `server/server.js`, or browser protocol files.

**Parameters:**
- Existing code commonly passes plain objects for config and events.
- Keep event payload shape explicit and testable.

**Return Values:**
- Status APIs return structured objects.
- Adapter mutation methods throw on hard failure.
- WebSocket handlers mostly mutate in-memory state and send messages.

## Module Design

**Exports:**
- Primary server classes are default exports.
- Config factories/constants use named exports alongside the default class.
- Browser scripts attach some protocol objects/classes to `globalThis`.

**State:**
- Server modules favor stateful classes with internal maps/objects.
- Browser modules rely on global event bus and `globalThis` exposure.

**Dependencies:**
- Do not add dependencies unless explicitly requested by the user.
- Current project intentionally avoids a bundler and TypeScript.

---
*Convention analysis: 2026-07-04*
*Update when patterns change*
