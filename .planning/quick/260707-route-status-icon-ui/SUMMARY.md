---
status: complete
completed: "2026-07-07T18:57:39Z"
---

# Route Status Icon UI Summary

Replaced verbose peer route-attempt status cards with compact badge/icon chips.

## Changed

- Added a route-attempt visual model that keeps the visible peer card copy to short route labels while preserving full detail in title/ARIA text.
- Rendered route attempts as compact chips with muted/struck blocked state and pulsing pending state.
- Hid route status copy visually for active route attempts so `Trying FIPS...` remains accessible without occupying card layout.
- Added reduced-motion handling for pending-route animations.

## Evidence

- Red/green focused test: `node --test test/route-attempts-ui.test.js`
- Browser visual proof: `/tmp/meshdrop-route-status-icons-mobile-dark.png`
- Visual verdict: `.omx/state/route-status-icons/ralph-progress.json` score 92/pass
- `npm test` passed 356/356
- `npm run test:e2e` passed browser transfer smoke
- `git diff --check` passed
- `npx --yes aislop scan --changes .` exited 0 with no AI-slop/security/lint findings; existing code-quality warnings remain for large/duplicated `public/scripts/ui.js`
- `npx --yes aislop scan .` failed on existing full-repo baseline warnings outside this UI change

## Remaining Risk

Full-repo slop baseline remains failing on existing large files, vendor lint warnings, and `server/nostr-identity.js` hardcoded URL warning.
