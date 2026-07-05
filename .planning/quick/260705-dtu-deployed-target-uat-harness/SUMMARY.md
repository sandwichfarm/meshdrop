# Deployed Target UAT Harness Summary

## Result

Added fail-closed deployed UAT harnesses for real Start9 and Umbrel installs.

The harnesses require the installed service URL, validate `/config` target/capability negotiation, and then reuse the
browser transfer smoke to prove local and Pollen WebRTC transfers against the deployed service.

## Evidence

- `node --test test/docker-smoke-script.test.js test/deployed-target-uat.test.js test/uat-runbooks.test.js` passed 7/7.
- `node --check scripts/deployed-target-uat.mjs` passed.
- `npm run test:start9-deployed` failed closed without `MESHDROP_START9_UAT_URL`.
- `npm run test:umbrel-deployed` failed closed without `MESHDROP_UMBREL_UAT_URL`.
- `npm test` passed 216/216.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran; baseline still fails with 57 pre-existing warnings outside this change.

## Known Gaps

- Real StartOS device UAT is not proven until `MESHDROP_START9_UAT_URL=<url> npm run test:start9-deployed` passes
  after UI install.
- Real Umbrel node UAT is not proven until `MESHDROP_UMBREL_UAT_URL=<url> npm run test:umbrel-deployed` passes after
  UI install.
