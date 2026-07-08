---
status: complete
created: "2026-07-08"
completed: "2026-07-08T19:10:57+02:00"
---

# Use Non-Default FIPS Host Ports

## Goal

Publish container FIPS transports on non-default host ports while keeping the in-container FIPS daemon bind addresses unchanged. Also print the local FIPS DNS URL in the federation status log and add a one-command local SPA dev path.

## Plan

1. Change Docker Compose host-only FIPS port mappings.
2. Keep `fips.yaml` internal UDP/TCP binds and mesh peer addresses untouched.
3. Log `http://<npub>.fips:<port>` beside local FIPS IPv6/base URL when FIPS status is available.
4. Add `pnpm dev:spa` for serving the packaged backend-free SPA locally on a predictable port.
5. Verify compose config, Docker smoke, focused federation test, SPA dev boot/curl, broad tests, diff check, and changed-code slop.

## Verification

- `docker compose config`
- `node --test test/federation-server.test.js`
- `npm test`
- `npm run test:docker`
- `pnpm dev:spa` plus local HTTP readback
- `git diff --check`
- `npx --yes aislop scan --changes .`
