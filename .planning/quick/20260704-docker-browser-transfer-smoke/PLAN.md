# Prove browser file transfer against Docker

## Problem

The Docker target smoke currently proves container boot, configuration, and served assets,
but it does not initiate a browser file transfer against the built container.
The finish-line goal requires real transfer proof before any target path can be trusted.

## Scope

- Reuse the browser transfer proof pattern against the Docker base URL.
- Make `npm run test:docker` initiate a local WebRTC file transfer between two browser peers served by the built container.
- Update CI so the Docker smoke job has Chromium available.
- Update Docker UAT docs/status to reflect the stronger automated proof.
- Add a static regression that locks the Docker smoke to browser transfer proof.

## Out Of Scope

- Public two-host relay UAT.
- FIPS/Pollen browser transfer proof inside Docker.
- Real release tag or GHCR readback.

## Verification Plan

- Red/green `node --test test/docker-smoke-script.test.js`.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
