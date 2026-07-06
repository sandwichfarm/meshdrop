# Docker FIPS default control socket

## Goal

Make the default Docker Compose FIPS path work without a `FIPS_CONTROL_SOCKET`
environment override.

## Plan

1. Reproduce the current mismatch between the FIPS daemon socket and the server control client.
2. Make the server default to the in-container Unix socket used by the daemon.
3. Keep explicit TCP socket overrides working for tests and mock control servers.
4. Rebuild and restart the operator Docker Compose service.
5. Verify `/fips/status` reports `available: true`.

## Verification

- `node --test test/fips-control.test.js test/docker-smoke-script.test.js`
- `npm test`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
- `docker compose up --build -d --force-recreate`
- `curl -fsS http://127.0.0.1:3000/fips/status`
