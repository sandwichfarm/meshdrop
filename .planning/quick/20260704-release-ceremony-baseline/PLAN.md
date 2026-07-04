# Release Ceremony Baseline

## Goal

Make alpha `v0.x.y` tag pushes produce release artifacts and GHCR images for the current Docker-based target set.

## Scope

- Replace the stale single-image GHCR workflow with a target matrix for `standalone`, `start9`, and `umbrel`.
- Replace the stale PairDrop CLI zip workflow with a MeshDrop release workflow.
- Keep workflows tag-triggered so CI/CT does not rerun more often than needed.
- Pin actions to current release SHAs verified on 2026-07-04.

## Out Of Scope

- Full Start9/Umbrel package manifests.
- Desktop/mobile/native artifacts.
- Creating a live release tag during this task.

## Validation

- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml .github/workflows/github-image.yml .github/workflows/release.yml`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
