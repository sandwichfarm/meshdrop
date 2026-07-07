---
status: complete
created: 2026-07-07
slug: fix-clearnet-off-peer-route-ui-so-nostr-
---

# Quick Task: Clearnet-Off Peer Route UI

## Goal

When Clearnet file routes are disabled, Nostr WOT discovery must stay active but the peer card must not present the discovered Nostr route as an active Clearnet transport. If the peer advertises FIPS or Pollen route capability, the pending card should show the private route being attempted.

## Plan

- Reproduce the mismatch from source: raw Nostr `peer-joined` events currently add a `nostr` room to UI even when route policy disables Clearnet.
- Update UI route tracking to use the same Clearnet route policy as the network manager.
- Render pending private route status as FIPS/Pollen availability and text.
- Add focused tests for route-status text/badge and disabled-Clearnet route-status events.

## Verification Plan

- `node --test test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js`
- `npm test`
- `npm run test:e2e`
- `npm run test:docker`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Result

- Disabled Nostr/Clearnet discovery no longer creates an active `nostr` route badge in the peer UI.
- Pending private route status can render FIPS/Pollen badges even before the encrypted descriptor response arrives.
- `requested` route status now displays as `Trying <route>...`.
