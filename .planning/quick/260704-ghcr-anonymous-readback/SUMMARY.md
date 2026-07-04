---
status: complete
completed: 2026-07-04
slug: ghcr-anonymous-readback
---

# Summary

Added a local anonymous GHCR manifest verifier for alpha release tags and recorded the current `v0.1.0` visibility
blocker without overstating release-image support.

## Changed

- Added `npm run verify:ghcr-anonymous -- v0.x.y`.
- The verifier uses a temporary `DOCKER_CONFIG`, checks `standalone`, `start9`, and `umbrel`, and requires both
  `linux/amd64` and `linux/arm64` manifests for `v0.x.y-*` plus `0.x.y-*` tag forms.
- Updated release UAT docs and target status to say authenticated `v0.1.0` readback is proven, while anonymous GHCR
  readback remains blocked until package visibility is public or a newer release proves it.

## Evidence

- `node --check scripts/ghcr-anonymous-readback.mjs` passed.
- `node --test test/release-workflow.test.js test/uat-runbooks.test.js` passed: 6/6.
- `npm run verify:ghcr-anonymous -- v0.1.0` failed as expected with GHCR `unauthorized` for
  `ghcr.io/sandwichfarm/meshdrop:v0.1.0-standalone`.
- `gh api /orgs/sandwichfarm/packages/container/meshdrop --jq '.name'` returned 403 requiring `read:packages`.
- `gh auth status` showed no `read:packages` or `write:packages` scope.
- `npm test` passed: 179/179 after `npm ci`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still fails on the known repo baseline: 461 no-undef lint errors, 3 `innerHTML`
  security errors, and style/complexity warnings.

## Remaining Risk

- Current `v0.1.0` anonymous GHCR readback is not proven.
- This session cannot inspect or change GitHub package visibility with the available token.
