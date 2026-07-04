---
status: complete
completed: 2026-07-04
slug: docker-deployed-admin-uat
---

# Docker Deployed Admin UAT Summary

## Result

Added and proved an isolated compose deployed-admin UAT for the Docker shared-instance path.

The UAT inherits `docker-compose.yml`, overrides the container name and host ports so it can run beside an existing
`meshdrop` container, injects a temporary `MESHDROP_ADMIN_NPUB`, starts the service with Docker Compose, checks `/config`,
confirms configured FIPS/Pollen `npub-network:` IDs, drives signed admin settings from the GUI, verifies non-admin
settings rejection, and initiates local plus Pollen browser transfers.

## Fix

The first real-FIPS run exposed a bug hidden by the old mock: MeshDrop sent FIPS `connect` params as `peer`, while the
real FIPS control daemon expects `npub`. `server/fips-control.js` now sends the real daemon contract and the unit test
locks that command shape.

## Evidence

- Red guard: `node --test test/docker-smoke-script.test.js test/uat-runbooks.test.js` failed before the UAT command,
  script, and docs existed.
- Focused green: `node --test test/fips-control.test.js test/server-admin-settings.test.js
  test/docker-smoke-script.test.js test/uat-runbooks.test.js`.
- Runtime green: `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs
  PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker:admin`.
- Repo green: `npm test` passed 166/166.
- Docker green: `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs
  PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker`.
- E2E green: `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs
  PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.
- Diff/slop: `git diff --check` passed; `npx --yes aislop scan --changes .` passed clean.
- Baseline: `npx --yes aislop scan .` remains failing on pre-existing repo-wide issues.
- Runtime proof lines:
  - `Proof docker-admin-settings: signed admin GUI saved FIPS peers`
  - `Proof docker-local-webrtc: local delivered meshdrop-proof-icon.svg`
  - `Proof docker-pollen-webrtc: pollen-mesh delivered meshdrop-proof-icon.svg`
  - `Proof docker-deployed-admin-settings: compose admin ... saved FIPS peers`

## Remaining Gaps

- SPA WebKit transfer UAT remains open.
- Start9 `.s9pk`, Start9 device install/transfer UAT, and Umbrel device install/transfer UAT remain open.
- Desktop native, iOS, and Android targets remain unimplemented.
- Full objective remains active.
