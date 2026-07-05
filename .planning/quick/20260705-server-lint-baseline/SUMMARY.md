---
status: complete
completed: 2026-07-05
task: Reduce server lint baseline warnings
---

# Summary

Reduced low-risk server startup lint and AI-slop baseline warnings.

## Changes

- Replaced startup and exception `console.log`/`console.info`/`console.debug` calls in `server/index.js` with explicit stdout/stderr writes.
- Removed restating comments in touched server files.
- Replaced fragile `SIGNALING_SERVER` character-class validation with URL parsing and `includes` / `endsWith` checks.
- Removed an unused malformed-JSON catch parameter in `server/ws-server.js`.

## Verification

- `node --check server/index.js && node --check server/ws-server.js`
- `npm test` -> 200 passed after `npm install` populated fresh worktree dependencies
- `git diff --check`
- `npx --yes aislop scan --changes .` -> exit 0, 0 errors, 0 AI-slop issues, 1 file-size warning in touched legacy `server/ws-server.js`
- `npx --yes aislop scan .` -> exit 1, 0 errors, 78 baseline warnings

## Known Gaps

- Full-repo `aislop` still fails on warning baseline: vendored noble-ciphers unused expressions, large files, duplicate blocks, server peer logs/comments/URLs, TODOs, and one empty vendored utility function.
- This slice intentionally leaves broad server logging and vendored-library cleanup for separate PRs.
