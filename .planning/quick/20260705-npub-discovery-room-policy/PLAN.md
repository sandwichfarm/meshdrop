# Npub Discovery Room Policy Plan

## Goal

Prevent FIPS and Pollen discovery from using legacy/static room IDs when config is injected directly, while preserving npub-network discovery generated from configured Nostr pubkeys.

## Scope

- Normalize server-exposed FIPS/Pollen room IDs to `npub-network:*`.
- Normalize browser FIPS status/config room display to avoid surfacing static IDs.
- Add focused tests for accepted npub-network IDs and rejected static IDs.

## Verification

- `node --test test/fips-discovery-protocol.test.js test/action-visibility.test.js test/fips-control.test.js test/runtime-capabilities.test.js test/server-admin-settings.test.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
