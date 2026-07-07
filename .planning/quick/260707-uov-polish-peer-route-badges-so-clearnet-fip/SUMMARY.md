---
status: complete
completed: "2026-07-07T20:10:53Z"
---

# Polish Peer Route Badges Summary

Removed visible wrapped route-attempt words from the compact peer/route-choice badge surfaces.

## Changed

- Reused one route-attempt chip renderer for peer cards and transfer-choice route attempt status.
- Kept Clearnet/FIPS/Pollen status detail in `title`/ARIA while visible layout renders icon-only chips.
- Hid peer status text whenever route-attempt visuals are present, including fallback cases without `data-route`.
- Preserved muted/struck blocked Clearnet styling and pending FIPS/Pollen pulse animations.
- Updated the browser E2E route-choice assertion to require accessible proof detail and reject visible attempt text.

## Evidence

- `node --test test/route-attempts-ui.test.js` passed 7/7.
- Browser visual proof: `/tmp/meshdrop-route-badge-motion-mobile-dark.png`; route chip text array was empty, pending chips used `route-chip-pulse`, blocked Clearnet opacity was `0.44`.
- `npm test` passed 357/357.
- `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed browser transfer smoke.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with no AI-slop/security/lint findings; existing code-quality warnings remain for large/duplicated legacy files.

## Remaining Risk

- Full-repo slop scan not run for this narrow UI polish slice.
- Existing `public/scripts/ui.js` and `scripts/e2e-smoke.mjs` size/complexity warnings remain baseline debt.
