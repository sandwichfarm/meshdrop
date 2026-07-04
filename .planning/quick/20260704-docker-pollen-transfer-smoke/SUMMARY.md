---
status: complete
completed: 2026-07-04
branch: agent/docker-pollen-transfer-smoke-20260704
---

# Docker Pollen Transfer Smoke Summary

## Completed

- Extended the Docker browser transfer smoke from local WebRTC-only proof to two browser-served transfer proofs.
- Kept the Docker smoke running against the built `meshdrop:smoke` container and its published HTTP port.
- Added a Pollen mesh proof that enables Pollen transfer in both browser peers, waits for Pollen peer visibility, and sends
  `meshdrop-proof-icon.svg` through the `pollen-mesh` transport.
- Updated Docker UAT docs and target status so they claim local WebRTC plus Pollen mesh proof, without overclaiming
  two-host relay, FIPS-in-Docker, or admin GUI UAT.
- Added static regression coverage so `npm run test:docker` stays wired to the Pollen browser transfer proof.

## Evidence

- Red proof: `node --test test/docker-smoke-script.test.js` failed before implementation because
  `docker-pollen-webrtc` was missing.
- `node --test test/docker-smoke-script.test.js test/uat-runbooks.test.js` passed: 2/2.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker` passed and logged:
  `Proof docker-local-webrtc: local delivered meshdrop-proof-icon.svg` and
  `Proof docker-pollen-webrtc: pollen-mesh delivered meshdrop-proof-icon.svg`.
- `npm test` passed: 159/159.
- `git diff --check` passed.
- Changed-file line-length check passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors, 3 direct `innerHTML`
  security findings in `public/scripts/ui.js`, console/trivial-comment warnings, duplicate-code warnings, and file-size
  warnings.

## Known Gaps

- Docker smoke still does not prove FIPS browser transfer inside Docker because the smoke container has no attached FIPS
  daemon.
- Docker shared-instance admin GUI UAT and public two-host relay UAT remain separate proof surfaces.
- No real `v0.*.*` release tag or GHCR readback was performed in this slice.
