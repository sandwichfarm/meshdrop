---
status: complete
created: 2026-07-04
branch: agent/spa-runtime-capabilities-20260704
---

# SPA Runtime Capabilities

## Goal

Give the static SPA path truthful runtime capability data so backend-only controls do not appear when no MeshDrop backend is present.

## Scope

- Add a no-backend SPA capability shape.
- Let the browser fall back to static SPA config when `/config` is unavailable.
- Prevent backend-only local/FIPS/Pollen/admin controls from activating under that config.

## Out Of Scope

- Start9/Umbrel packaging.
- Desktop/mobile packaging.
- New dependencies.

## Validation

- Focused capability/UI tests fail first, then pass.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
