# Prove Docker admin GUI settings path

## Problem

Docker UAT still leaves shared-instance admin GUI proof manual. Existing unit/server tests prove admin signing and backend
authorization, but the Docker smoke does not prove the container-served GUI can sign in as the configured admin and submit a
signed FIPS settings request.

## Scope

- Extend Docker smoke to generate the configured admin keypair at runtime and pass the private key only to the browser smoke.
- Add a Docker-served browser proof that signs in through a NIP-07-style test signer, reveals the FIPS settings tab, submits a
  signed FIPS peer save through the GUI code path, and observes the success status.
- Prove a non-admin browser keeps the FIPS settings tab hidden.
- Update Docker UAT docs/status to record automated admin GUI smoke coverage without claiming full deployed-host UAT.
- Add a regression that keeps `npm run test:docker` wired to admin GUI proof.

## Out Of Scope

- Persisting real FIPS peer config across container restarts.
- Public two-host relay UAT.
- Real deployment with a human NIP-07 wallet.

## Verification Plan

- Red/green `node --test test/docker-smoke-script.test.js`.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:docker`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
