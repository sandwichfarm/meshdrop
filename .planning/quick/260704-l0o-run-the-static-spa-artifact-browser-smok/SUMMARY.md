---
status: complete
completed: 2026-07-04T13:09:30Z
---

# Summary

Added the static SPA artifact smoke to the existing browser CI job.

The browser job already installs Chromium for transfer proof, so it now also runs `npm run test:spa-artifact` in the same job. Existing workflow path filters still skip docs-only and `.planning`-only changes.

The first PR CI run exposed a runner-only module resolution bug: the SPA smoke preferred this workstation's `/usr/lib/node_modules/playwright/index.mjs` path even when GitHub runners only had the npm package. The smoke now matches the e2e loader behavior: use an explicit readable `PLAYWRIGHT_MODULE_PATH` when provided, otherwise fall back to importing the package dependency.

## Evidence

- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml` passed.
- `npm ci` passed with 0 vulnerabilities.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact` passed.
- `node --test test/spa-artifact.test.js` passed: 2/2.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline.

## Known Gaps

- The full repo aislop baseline remains failing outside this slice.
- Release-tag upload and public two-host SPA transfer UAT are still not proven.
