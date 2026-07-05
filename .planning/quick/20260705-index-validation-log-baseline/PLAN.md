# Index Validation Log Baseline

## Goal

Reduce server startup validation console warnings in `server/index.js` without changing configuration validation behavior.

## Scope

- Replace validation-failure `console.error` output with the existing explicit stderr writer.
- Preserve exit codes, message text, and validation branches.
- Leave WebSocket and federation warning cleanup for separate PRs.

## Verification

- `node --check server/index.js`
- Focused command-line validation checks for invalid `IPV6_LOCALIZE` and `SIGNALING_SERVER` inputs.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
