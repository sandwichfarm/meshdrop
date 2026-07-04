---
status: complete
---

# Summary

## Change

- Added a Docker-only browser transfer smoke that opens two Chromium peers against the built container and transfers
  `meshdrop-proof-icon.svg` over local WebRTC.
- Made `npm run test:docker` run that browser transfer proof after the existing container config and asset checks.
- Added Chromium installation to the Docker CI job.
- Updated Docker UAT docs and the target status ledger to reflect container-served local WebRTC transfer proof.
- Added a static regression that keeps Docker smoke wired to the browser transfer proof.

## Evidence

- Red proof: `node --test test/docker-smoke-script.test.js` failed before the Docker smoke called browser transfer proof.
- `node --test test/docker-smoke-script.test.js test/uat-runbooks.test.js` passed: 2/2.
- First `npm run test:docker` failed before code execution because this fresh worktree had no `node_modules`.
- `npm ci` passed with 0 vulnerabilities.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker` passed and logged
  `Proof docker-local-webrtc: local delivered meshdrop-proof-icon.svg`.
- `npm test` passed: 159/159.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml` passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors,
  3 direct `innerHTML` security findings in `public/scripts/ui.js`, console/trivial-comment warnings,
  duplicate-code warnings, and file-size warnings.

## Known Gaps

- Docker transfer proof covers local WebRTC only, not FIPS/Pollen transfers inside Docker.
- Docker shared-instance admin GUI UAT across a real deployed host remains manual/future proof.
- No public two-host relay UAT or real release-tag GHCR readback was performed.
