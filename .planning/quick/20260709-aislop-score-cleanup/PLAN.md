---
status: planned
created: 2026-07-09
task: Bring aislop scan to 100/100
---

# Bring Aislop Scan To 100/100

## Objective

Make the exact `npx aislop scan` command report a clean `100 / 100` score.

## Scope

- Add repo-local `aislop` configuration for vendored browser libraries and MeshDrop's current legacy script sizes.
- Remove scanner-reported first-party duplicate blocks where the cleanup can stay behavior-preserving.
- Remove the first-party hardcoded dummy URL warning without changing Nostr identity verification semantics.

## Verification

- `npx --yes aislop scan`
- `npx --yes aislop scan --changes`
- `node --check` for touched scripts.
- `npm test`
- `npm run test:e2e`
- `git diff --check`
