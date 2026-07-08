# Use Non-Default FIPS Host Ports Summary

Status: complete

## Changed

- Docker Compose publishes FIPS UDP on host `12121` to container `2121/udp`.
- Docker Compose publishes FIPS TCP on host `18443` to container `8443/tcp`.
- `fips.yaml` stays on default in-container FIPS bind ports so daemon config and mesh peer addresses do not change.
- Federation FIPS status logging now includes `fipsUrl=http://<npub>.fips:<port>` when the local FIPS daemon reports an npub.

## Evidence

- `docker compose config` -> publishes FIPS UDP `12121` to container `2121/udp` and FIPS TCP `18443` to container `8443/tcp`.
- `node --test test/federation-server.test.js` -> 41/41 pass, including `fipsUrl=http://<npub>.fips:3000` trace coverage.
- `npm test` -> 407/407 pass.
- `npm run test:docker` -> passed; image `sha256:c02e6e957baedc102dfa51f8e457984f8a8428053e96dcb9236dbe996f824bd3`, FIPS status, served page, browser transfer, signed admin FIPS save, and two-host Nostr relay proof all passed.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.

## Remaining Risk

- The task worktree did not run `docker compose up` because an existing operator container named `meshdrop` is already running from `/home/sandwich/Develop/meshdrop`; replacing it would have clobbered live state.
