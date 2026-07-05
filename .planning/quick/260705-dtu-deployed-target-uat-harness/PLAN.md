# Deployed Target UAT Harness

## Objective

Add a fail-closed UAT harness for real Start9 and Umbrel installs so device/node UI transfer proof can be collected
without confusing package-environment smoke tests with real deployed UAT.

## Scope

- Add `npm run test:start9-deployed` and `npm run test:umbrel-deployed`.
- Require target-specific installed service URLs before running.
- Validate `/config` target/capability negotiation before transfer proof.
- Reuse the existing browser transfer smoke to initiate local and Pollen WebRTC transfers.
- Keep target status honest: harness exists, real installed-device pass remains open until run against hardware/node UI.

## Verification

- `node --test test/deployed-target-uat.test.js test/uat-runbooks.test.js`
- `node --check scripts/deployed-target-uat.mjs`
- `npm run test:start9-deployed` fail-closed proof with missing URL
- `npm run test:umbrel-deployed` fail-closed proof with missing URL
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
