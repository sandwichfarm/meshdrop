# Release Verification Workflow Summary

## Changed

- Added `release-verify.yml`, a dispatchable workflow for alpha release readback.
- The workflow checks the GitHub release asset set, GHCR multi-arch manifests, target metadata on pulled images, and Docker
  transfer smoke against the pulled standalone release image.
- Updated the release-image UAT runbook to use `release-verify.yml` when local tokens cannot read GHCR packages.
- Added tests so future workflow/doc changes keep release readback coverage.

## Verification

- Red proof: `node --test test/release-workflow.test.js` failed before adding the workflow because
  `.github/workflows/release-verify.yml` did not exist.
- `node --test test/release-workflow.test.js test/uat-runbooks.test.js` passed: 5/5.
- Release workflow YAML parse passed for `release.yml` and `release-verify.yml`.

## Remaining

- Local GHCR readback is still blocked by this host token lacking `read:packages`.

## Live Dispatch

- PR #27 merged to `master` at `89b889ee5940a728c3aa8e61dbf383a4fa26f406`.
- Master CI run `28711396305` passed after merge.
- `release-verify.yml` run `28711452622` passed for `v0.1.0`.
- The verification run checked GitHub release assets, GHCR `linux/amd64` and `linux/arm64` manifests, pulled target
  metadata for `standalone`, `start9`, and `umbrel`, and Docker transfer smoke against the pulled standalone release image.
