# Server Main Log Baseline

## Goal

Reduce AI-slop/logging baseline warnings in `server/server.js` without changing HTTP route behavior.

## Scope

- Replace startup, debug, and address-in-use `console.*` calls with explicit stdout/stderr writes.
- Keep the existing rate-limit debug guidance and `/ip` route behavior.
- Leave broader federation and vendored baseline warnings for separate PRs.

## Verification

- `node --check server/server.js`
- Focused server/admin tests that import `server/server.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
