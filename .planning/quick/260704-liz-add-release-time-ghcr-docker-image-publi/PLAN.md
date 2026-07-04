# Add release-time GHCR target images

## Problem

The goal requires every alpha release tag to produce GitHub release artifacts and GHCR Docker images for each target:
`standalone`, `start9`, and `umbrel`. Current `release.yml` only creates tarball artifacts and a GitHub release.

## Scope

- Add release-time GHCR image publishing for the three target names.
- Keep the implementation on existing Docker CLI and `GITHUB_TOKEN`; add no new Actions dependencies.
- Record the target in image metadata so release images are distinguishable.
- Add a static regression that locks the workflow/image target contract.

## Out Of Scope

- Real Start9/Umbrel package manifests and marketplace packaging.
- Multi-architecture image publication.
- Running a real `v0.*.*` release tag.

## Verification Plan

- `node --test test/release-workflow.test.js`.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml`.
- `docker build --build-arg MESHDROP_TARGET=start9 ...` and inspect target env/label.
- `npm test`, `npm run test:docker`, `npm run test:spa-artifact`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`, `npx --yes aislop scan .`.
