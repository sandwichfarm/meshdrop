# Prove Docker Pollen browser transfer

## Problem

Docker smoke now proves local WebRTC transfer from the built container, but it still does not prove Pollen browser transfer
inside the Docker runtime. The finish-line goal requires transfer proof over every enabled transport path.

## Scope

- Extend Docker browser transfer smoke to prove both local WebRTC and Pollen mesh transfer against the built container.
- Keep the proof browser-based and served from the Docker image.
- Update Docker UAT docs/status to distinguish local and Pollen container transfer proof.
- Add a regression that locks the Docker smoke to Pollen transfer proof.

## Out Of Scope

- FIPS browser transfer proof inside Docker, because the current smoke container reports no attached FIPS daemon.
- Public two-host relay UAT.
- Real release tag or GHCR readback.

## Verification Plan

- Red/green `node --test test/docker-smoke-script.test.js`.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
