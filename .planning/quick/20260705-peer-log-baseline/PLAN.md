---
status: planned
created: 2026-07-05
task: Reduce peer logging baseline warnings
---

# Reduce Peer Logging Baseline Warnings

## Objective

Reduce low-risk `aislop` AI-slop warnings in `server/peer.js` while preserving peer identity, IP localization, and room behavior.

## Scope

- Replace debug-mode peer IP `console.debug` calls with explicit stdout writes.
- Remove the restating IPv4-translated-address comment.
- Avoid broad peer/server refactors and do not change peer identity or room assignment logic.

## Verification

- `node --check server/peer.js`
- Focused peer/server tests
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
