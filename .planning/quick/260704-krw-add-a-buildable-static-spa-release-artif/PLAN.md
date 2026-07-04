---
status: complete
created: 2026-07-04T12:57:28.426Z
---

# Add Static SPA Artifact And UAT Runbook

## Goal

Make the no-backend SPA target a buildable release artifact with UAT instructions that prove the runtime negotiates truthfully when served by a static host.

## Scope

- Add a dependency-free SPA artifact builder.
- Add a smoke test that builds the artifact, inspects its contents, serves the unpacked artifact, and proves the browser negotiates the static no-backend runtime.
- Add the SPA artifact to the tag release workflow.
- Add a SPA UAT runbook for release/manual validation.

## Out Of Scope

- Start9, Umbrel, native desktop, and mobile packages.
- Full release tag execution.
- Public relay proof across separate deployed hosts.

## Validation

- `node --test test/spa-artifact.test.js`
- `npm test`
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
