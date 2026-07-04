---
status: complete
created: 2026-07-04T13:08:01.765Z
---

# Run SPA Artifact Smoke In CI

## Goal

Make GitHub CI prove the static SPA artifact browser smoke, not just local runs.

## Scope

- Add `npm run test:spa-artifact` to the existing browser CI job after Chromium is installed.
- Keep the job in the existing source-change CI workflow so docs and `.planning` changes still skip CI through existing path filters.
- Record focused local proof and CI proof in GSD.

## Out Of Scope

- New CI actions or dependencies.
- Release-tag execution.
- Start9, Umbrel, native, or mobile target packaging.

## Validation

- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml`
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
