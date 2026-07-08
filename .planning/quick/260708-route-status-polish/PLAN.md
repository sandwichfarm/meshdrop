---
status: complete
created: "2026-07-08"
---

# Route Status Polish

## Goal

Make route-attempt cards visibly icon/animation-first so blocked Clearnet, pending FIPS, and pending Pollen never depend on cramped visible words.

## Plan

1. Lock a focused UI contract for compact, motion-based route attempt chips and service-worker cache refresh.
2. Polish the chip visuals with clearer Clearnet strike/low opacity and more refined FIPS/Pollen pending motion.
3. Prove the rendered mobile peer card has no visible route-status words and still exposes accessible detail.

## Verification

- `node --test test/route-attempts-ui.test.js`
- Browser/mobile screenshot for disabled Clearnet plus pending FIPS/Pollen.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
