# Release Verification Workflow

## Goal

Add a repo-owned workflow that can verify an alpha release after publication using GitHub Actions package permissions.

## Context

Release `v0.1.0` published successfully, but local GHCR readback is blocked because the current `gh` token lacks
`read:packages`. The verification path needs to run with a token that can read the repo-owned GHCR package.

## Scope

- Add `.github/workflows/release-verify.yml` with `workflow_dispatch`.
- Verify the GitHub release asset set for a supplied `v0.*.*` tag.
- Verify both tag-preserving and version-only GHCR tags for `standalone`, `start9`, and `umbrel`.
- Verify each pulled target image records the expected target metadata.
- Run `npm run test:docker` against the pulled standalone release image.

## Out Of Scope

- Rebuilding or replacing the already published `v0.1.0` artifacts.
- Marking Start9, Umbrel, desktop, iOS, or Android complete.
- Making the GHCR package public.

## Validation

- Red: `node --test test/release-workflow.test.js` fails before adding `release-verify.yml`.
- Green: `node --test test/release-workflow.test.js test/uat-runbooks.test.js`.
- YAML parse for release workflows.
- `npm test`.
- `git diff --check` and `git diff --cached --check`.
