---
status: complete
completed: 2026-07-07
slug: fix-clearnet-off-peer-route-ui-so-nostr-
---

# Clearnet-Off Peer Route UI Summary

## Changed

- `PeersUI` now applies the same Clearnet route policy used by the network manager before displaying raw `nostr` peer-joined events.
- Disabled Clearnet/Nostr discovery with FIPS or Pollen route capability creates a pending private-route status instead of a Clearnet room badge.
- Pending private route status contributes a FIPS/Pollen availability pill and `requested` displays as `Trying <route>...`.
- Regression tests cover disabled-Nostr route-status events and pending FIPS UI availability.

## Verified

- `node --check public/scripts/ui.js`
- `node --test test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js`
- `npm ci`
- `npm test`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Slop Gate

Changed-code scan exited 0 with zero formatting, AI-slop, security, and lint issues. It still reports pre-existing structural warnings because `public/scripts/ui.js` is a large legacy file with old duplicate blocks.

Full-repo scan remains baseline non-zero on existing large-file/duplicate warnings, vendored noble-ciphers lint warnings, vendored TODO/empty helper findings, and `server/nostr-identity.js:11` hardcoded URL.
