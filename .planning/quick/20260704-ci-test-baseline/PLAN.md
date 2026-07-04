# CI/CT Baseline

## Status

Complete

## Goal

Run deterministic GitHub Actions checks in the right places for the current MeshDrop baseline:

- unit tests
- browser WebRTC transfer proof
- Docker smoke proof

## Scope

- Replace the PR/master Docker-build-only workflow with staged CI jobs.
- Keep release/tag workflows separate.
- Skip CI for docs-only and planning-only changes.
- Make `scripts/e2e-smoke.mjs` portable between this Arch host and GitHub-hosted runners.

## Out of Scope

- GHCR release publishing.
- Start9, Umbrel, desktop, and mobile packaging.
- Full matrix target expansion beyond the current Docker/web baseline.

## Validation

- `npm test`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- workflow syntax/static checks
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Notes

- Playwright is pinned as a dev dependency because GitHub-hosted runners do not have this workstation's
  `/usr/lib/node_modules/playwright` path.
- `npx --yes aislop scan .` still fails on the pre-existing repo-wide baseline:
  485 undefined globals, 3 `public/scripts/ui.js` `innerHTML` security errors, and style/slop warnings.

## Evidence

- `npm ci` passed.
- `npm test` passed: 143/143.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml` passed.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors and pre-existing touched-file size/function warnings.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline.
