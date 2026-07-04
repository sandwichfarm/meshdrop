---
status: complete
created: 2026-07-04
slug: release-anonymous-verifier-ci
---

# Quick Task: Release Anonymous Verifier CI

## Goal

Make release verification use the same anonymous GHCR readback verifier locally and in GitHub Actions.

## Scope

- Require `release-verify.yml` to call `npm run verify:ghcr-anonymous -- "${tag}"`.
- Pass the repo-specific image base through `MESHDROP_GHCR_IMAGE_BASE`.
- Remove the duplicated anonymous manifest loop from the workflow.
- Keep the current authenticated manifest and pull/readback checks unchanged.

## Out Of Scope

- Changing GHCR package visibility.
- Cutting or re-running a release tag.
- Modifying release image publishing.

## Validation

- Focused release workflow test.
- YAML parse.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
