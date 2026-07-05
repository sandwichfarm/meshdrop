---
status: planned
created: 2026-07-05
task: Reduce server lint baseline warnings
---

# Reduce Server Lint Baseline Warnings

## Objective

Reduce low-risk full-repo `aislop` warnings in server startup code without changing server behavior.

## Scope

- Remove restating startup comments in `server/index.js`.
- Replace debug-looking `console.log` calls with explicit stdout/stderr writes for operational startup/error output.
- Simplify `SIGNALING_SERVER` validation warnings by removing unnecessary regex escapes and using `endsWith`.
- Remove the unused JSON parse catch parameter in `server/ws-server.js`.

## Verification

- `node --check server/index.js server/ws-server.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
