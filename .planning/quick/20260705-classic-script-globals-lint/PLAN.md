---
status: planned
created: 2026-07-05
task: Declare classic-script globals for full-repo lint
---

# Declare Classic-Script Globals For Full-Repo Lint

## Objective

Remove `aislop` full-repo `no-undef` errors caused by MeshDrop's intentional classic browser script load order, without converting the bundle to modules.

## Scope

- Use explicit `globalThis` references and provider exports where classic browser globals cross script files.
- Cover the service worker `clients` global.
- Do not mask actual missing runtime globals; prove browser hydration and transfers still work.

## Verification

- `npx --yes aislop scan .`
- `npx --yes aislop scan --changes .`
- `node --check` for touched scripts.
- `npm test`.
- `npm run test:e2e`.
