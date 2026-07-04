---
status: complete
created: 2026-07-04
slug: admin-npub-signed-settings
---

# Quick Task: Admin npub signed settings

## Goal

Implement the first Docker shared-instance admin slice: configure an admin npub, expose admin capability metadata, gate admin controls in the GUI, and add backend validation for signed Nostr admin requests.

## Scope

- Add runtime config for a single admin npub.
- Expose admin capability/config metadata through `/config`.
- Add backend helper/API validation for signed admin events from the configured admin.
- Add initial GUI gating so non-admin users do not see shared-instance controls.
- Cover behavior with focused tests and runtime/browser evidence proportional to changed surfaces.

## Out Of Scope

- Full FIPS config editor UX if it grows beyond the first signed request path.
- Restart implementation if the existing server process does not expose a safe restart primitive.
- SPA/native/mobile admin semantics.

## Verification Plan

- Focused unit/protocol tests for admin npub parsing and signature validation.
- Frontend test for admin control visibility.
- `npm test`
- `npm run test:e2e` for GUI/runtime behavior.
- `npm run test:docker` for compose/runtime config.
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Result

- Added a Docker/shared-instance admin npub config surface through `MESHDROP_ADMIN_NPUB`.
- Exposed `/config.admin` metadata with enabled state, normalized hex pubkey, and npub.
- Required signed Nostr admin events for `POST /settings/fips/peers`.
- Added a browser helper that hides the FIPS server-settings tab from non-admin identities and signs FIPS peer saves for the configured admin.
- Kept FIPS restart behavior on the existing save path.

## Verification Evidence

- `node --test test/admin-auth.test.js test/server-admin-settings.test.js test/admin-settings-protocol.test.js` passed: 7/7.
- `npm test` passed: 143/143.
- `npm run test:e2e` passed and proved local WebRTC, FIPS WebRTC, Pollen WebRTC, Pollen storage, Nostr WebRTC, and federated FIPS WebRTC transfers.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke` and verified admin config in container `/config`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors; remaining warnings are pre-existing `server/server.js` console statements in the touched-file baseline.
- `npx --yes aislop scan .` exited nonzero on existing repo-wide baseline: 485 no-undef errors, 3 existing `public/scripts/ui.js` innerHTML security errors, and style/slop warnings.

## Remaining Risk

- Not live-tested against public relays or separately deployed public hosts.
- This is the first signed admin path; broader backend config and restart controls still need follow-up slices.
