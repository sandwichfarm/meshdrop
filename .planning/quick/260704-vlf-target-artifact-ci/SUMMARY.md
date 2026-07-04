---
status: complete
completed: 2026-07-04
slug: target-artifact-ci
---

# Summary

CI now runs the Desktop/iOS/Android target artifact transfer smoke on pull requests and pushes to `master`.

The new `target-artifacts` job depends on unit tests, installs Chromium only, and runs `npm run test:target-artifacts`.
Manual public relay and WebKit UAT jobs are unchanged.

## Evidence

- Red proof: `node --test test/ci-workflow.test.js` failed before the workflow job existed.
- `node --test test/ci-workflow.test.js` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml` passed.
- `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:target-artifacts`
  passed and logged desktop, iOS, and Android proof-file delivery.
- `npm test` passed: 175/175.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still exits nonzero on the existing repo-wide baseline: browser global `no-undef` errors,
  `public/scripts/ui.js` direct `innerHTML` security findings, console/trivial-comment warnings, duplicate-code warnings,
  and file-size warnings.

## Not Proven

- Native desktop/mobile shells or device UAT.
- Public relay/device UAT for the target source artifacts.
- GHCR anonymous package visibility.
