# Remove duplicate GHCR tag workflow

## Problem

The alpha release path had two tag-triggered workflows that could publish container images:

- `.github/workflows/release.yml`
- `.github/workflows/github-image.yml`

The goal explicitly says CI/CT/CD should not run more than it has to. Duplicating GHCR image publication on the same `v0.*.*`
tag increases release time and can publish inconsistent image tags.

## Scope

- Keep `release.yml` as the single tag-triggered release surface.
- Delete the redundant GHCR-only workflow.
- Add a regression so a separate `github-image.yml` cannot silently reappear.

## Verification Plan

- Red proof: `node --test test/release-workflow.test.js` fails while `github-image.yml` exists.
- `node --test test/release-workflow.test.js`.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml .github/workflows/docker-image.yml`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
