# Docker FIPS default control socket summary

## Result

FIPS now works from the default Docker Compose configuration without
`FIPS_CONTROL_SOCKET`.

## Evidence

- Before the fix, `/fips/status` returned `available: false` with
  `connect ECONNREFUSED 127.0.0.1:21210` while container logs showed FIPS
  listening on `/run/fips/control.sock`.
- The server default control socket is now `/run/fips/control.sock`.
- `docker-compose.yml` no longer needs or sets `FIPS_CONTROL_SOCKET`.
- `docker compose up --build -d --force-recreate` rebuilt `meshdrop:local` and
  restarted the `meshdrop` container.
- Runtime readback: `/fips/status` returned `available: true`, logs showed
  `FIPS running` and `Control socket listening path=/run/fips/control.sock`,
  and container env readback did not include `FIPS_CONTROL_SOCKET`.

## Verification

- `node --test test/fips-control.test.js test/docker-smoke-script.test.js` passed 11/11.
- `npm test` passed 249/249.
- `npm run test:docker` passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran and found only existing full-repo baseline warnings outside this change.
