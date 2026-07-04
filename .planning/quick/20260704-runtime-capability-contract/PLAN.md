# Runtime Capability Contract

## Goal

Expose a single runtime capability contract from `/config` and make backend-only GUI controls use it before showing actions.

## Scope

- Add server-side capability metadata for current standalone/server runtime features.
- Keep legacy `fips`, `pollen`, and `admin` config fields for current callers while making new code prefer capabilities.
- Gate FIPS discovery, Pollen transfer, and signed FIPS settings controls from negotiated capabilities.

## Out Of Scope

- SPA/static manifest generation.
- Desktop/mobile runtime implementations.
- Start9/Umbrel package manifests.

## Validation

- Focused unit tests for server capabilities and client gating.
- `npm test`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
