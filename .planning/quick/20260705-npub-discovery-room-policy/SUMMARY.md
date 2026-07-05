# Npub Discovery Room Policy Summary

## Result

FIPS and Pollen discovery room IDs are now constrained to `npub-network:*` at runtime boundaries:

- Server `/config` and runtime capabilities normalize static FIPS/Pollen room values to `npub-network:unconfigured`.
- `FipsControlClient` normalizes direct static room config before status reporting.
- Browser FIPS discovery config/status summaries hide static room IDs.

## Verification

- `node --test test/fips-discovery-protocol.test.js test/action-visibility.test.js test/fips-control.test.js test/runtime-capabilities.test.js test/server-admin-settings.test.js` -> 41/41 pass.
- `npm test` -> 201/201 pass.
- `git diff --check` -> pass.
- `npx --yes aislop scan --changes .` -> clean run, 0 issues.
- `npx --yes aislop scan .` -> baseline failing with 58 warnings outside this slice.

## Not Proven

- This slice does not prove real two-host FIPS or Pollen transport behavior.
- This slice does not prove physical-device mobile UAT.
- This slice does not change GHCR visibility or release proof.
