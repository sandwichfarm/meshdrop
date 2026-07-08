# Precache FIPS Host Dynamic Scripts Summary

Status: complete

## Changed

- Added every dynamically loaded app script from `public/scripts/main.js` to `public/service-worker.js` precache, including `scripts/nostr-relay-globals.js` and `scripts/nostr-pubkey.js`.
- Bumped the source service-worker cache key to `v1.11.9-route-status-polish-fips-script-assets`.
- Added a regression test that fails when dynamically loaded app scripts are missing from service-worker precache.

## Evidence

- `node --test test/service-worker-version.test.js` -> 4/4 pass.
- Browser cache proof against local server on `43123` -> cache `meshdrop-cache-v1.11.9-route-status-polish-fips-script-assets` contains both reported failing scripts.
- `curl -fsSI http://127.0.0.1:43123/scripts/nostr-relay-globals.js` -> `200 OK`, `Content-Type: application/javascript`.
- `curl -fsSI http://127.0.0.1:43123/scripts/nostr-pubkey.js` -> `200 OK`, `Content-Type: application/javascript`.
- `npm run build:service-worker` with `MESH_DROP_CACHE_VERSION=v1.11.9-route-status-polish-fips-script-assets` -> stamped deterministic cache key.
- `npm test` -> 408/408 pass.
- `npm run test:e2e` -> pass.
- `npm run test:spa-artifact` -> pass.
- `npm run test:docker` -> pass; image `sha256:aeb416ba26244d0a3a5f1bed5f2e1e0c5aa69fe2ba305f5915b97e8f5ea9235c`.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.

## Remaining Risk

- Full-repo `npx --yes aislop scan .` still fails on existing baseline issues outside this change: noble library unused-expression warnings, large files, duplicate code blocks, and one hardcoded URL warning in `server/nostr-identity.js`.
- Direct curl to `http://npub1...fips:3000/scripts/nostr-relay-globals.js` timed out on this machine, so live `.fips` DNS/daemon routing was not proven locally.
