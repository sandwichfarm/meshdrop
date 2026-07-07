---
status: complete
created: "2026-07-07"
---

# Polish Peer Route Badges

## Goal

Remove visible wrapped route-attempt words from the peer route UI while preserving accessible detail.

## Plan

1. Lock regression coverage for transfer-choice attempt rendering and peer-card status hiding.
2. Reuse route-attempt visual metadata for transfer-choice options so Clearnet/FIPS/Pollen render as compact icon chips.
3. Strengthen CSS so visible labels stay icon-only, blocked Clearnet is muted/struck, and pending FIPS/Pollen animate without layout growth.

## Verification

- `node --test test/route-attempts-ui.test.js`
- Browser/mobile screenshot for disabled Clearnet plus pending FIPS/Pollen.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
