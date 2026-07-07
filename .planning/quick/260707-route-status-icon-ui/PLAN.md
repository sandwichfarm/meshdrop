---
status: in_progress
created: "2026-07-07"
---

# Route Status Icon UI

## Goal

Replace verbose peer route-attempt copy with compact route badges that preserve accessible status detail.

## Plan

1. Add a visual route-attempt model that separates visible badge labels from detailed status copy.
2. Render peer route attempts as fixed-size badge/icon chips with muted blocked states and animated pending states.
3. Keep route status details in `title`/ARIA instead of visible wrapped text.
4. Verify with focused tests, browser screenshot, visual verdict, and repo gates.

## Verification

- Focused route-attempt UI tests.
- Browser mobile screenshot of disabled Clearnet plus pending FIPS/Pollen.
- `git diff --check`
- `npx --yes aislop scan --changes .`
