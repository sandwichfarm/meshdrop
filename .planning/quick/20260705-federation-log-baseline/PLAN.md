# Federation Log Baseline

## Goal

Reduce remaining server-side console warnings in `server/federation.js` without changing federation behavior.

## Scope

- Replace federation discovery, relay, and Pollen/Nostr `console.warn` output with explicit stderr writes.
- Preserve polling, connection, relay, and catch behavior.
- Leave non-server baseline warnings for later PRs.

## Verification

- `node --check server/federation.js`
- Focused federation tests.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
