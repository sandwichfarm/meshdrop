---
status: complete
completed: 2026-07-04
branch: agent/docker-admin-gui-smoke-20260704
---

# Docker Admin GUI Smoke Summary

## Completed

- Extended Docker smoke to generate a per-run admin keypair and configure `MESHDROP_ADMIN_NPUB` from that key.
- Added a container-local FIPS control smoke mock that responds to the real server FIPS control protocol during Docker
  smoke only.
- Added Docker-served browser proof that signs in with a NIP-07-style admin signer, reveals the FIPS settings tab, submits
  a signed FIPS peer save through the GUI path, and verifies the backend drove FIPS `connect` and `restart` commands.
- Added non-admin browser proof that the FIPS settings tab remains hidden and unsigned settings save is rejected by the GUI
  signer gate.
- Kept the existing Docker local WebRTC and Pollen mesh transfer proofs in the same smoke.
- Updated Docker UAT docs and target status to reflect automated admin GUI smoke without claiming real deployed-host UAT.

## Evidence

- Red proof: `node --test test/docker-smoke-script.test.js` failed before implementation because
  `MESHDROP_DOCKER_ADMIN_SECRET_KEY` was missing.
- First Docker proof failed before code execution in this fresh worktree because `node_modules` was missing.
- `npm ci` passed with 0 vulnerabilities.
- First host-side FIPS control mock attempt failed because the container could not reach the host mock.
- `node --test test/docker-smoke-script.test.js test/uat-runbooks.test.js` passed: 2/2.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker` passed and logged:
  `Proof docker-admin-settings: signed admin GUI saved FIPS peers`,
  `Proof docker-local-webrtc: local delivered meshdrop-proof-icon.svg`, and
  `Proof docker-pollen-webrtc: pollen-mesh delivered meshdrop-proof-icon.svg`.
- `npm test` passed: 159/159.
- `git diff --check` passed.
- Changed-file line-length check passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors, 3 direct `innerHTML`
  security findings in `public/scripts/ui.js`, console/trivial-comment warnings, duplicate-code warnings, and file-size
  warnings.

## Known Gaps

- Admin GUI smoke uses a deterministic container-local FIPS control mock, not a real deployed FIPS daemon.
- Real shared-instance admin UAT still needs a deployed host with the deployment admin npub and deployment FIPS control
  plane.
- Public two-host relay UAT remains unproven.
