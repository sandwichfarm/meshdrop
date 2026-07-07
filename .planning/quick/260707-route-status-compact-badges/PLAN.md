---
status: complete
slug: 260707-route-status-compact-badges
created: 2026-07-07
completed: 2026-07-07
---

# Compact Route Status Badges

## Objective

Replace peer-card route status words with icon-only visual badges so Clearnet blocked, FIPS pending, and Pollen pending states stay readable in tight peer cards.

## Scope

- Keep accessibility detail in `title` and `aria-label`.
- Keep route-attempt chips wordless.
- Make peer availability badges icon-only with route-specific symbols.
- Use low-opacity strike styling for blocked Clearnet.
- Use pulse/ring animation for pending FIPS/Pollen.
- Bump the service-worker cache id so cached UI assets refresh.

## Verification

- Red/green focused UI protocol test.
- Service-worker cache-version command.
- Focused route/status protocol tests.
- Visual/browser smoke of a peer card with Clearnet disabled plus FIPS/Pollen pending.
