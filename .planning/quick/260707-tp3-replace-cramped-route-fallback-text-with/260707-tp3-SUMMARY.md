---
status: complete
completed: "2026-07-07T19:31:38Z"
---

# Route Status Badge Polish Summary

Peer route-attempt chips are now icon-only on the radar card.

## Changed

- Removed visible route words from `.route-attempt` chips while keeping the full message, reason, and privacy context in `title`/ARIA.
- Tightened route attempts into fixed icon badges so three routes fit the mobile peer width without wrapping.
- Styled blocked routes with low opacity and a strike mark; pending FIPS/Pollen routes keep the existing pulse/ring motion.
- Strengthened focused route UI tests to assert no visible route-attempt text remains.

## Evidence

- `node --test test/route-attempts-ui.test.js` passed 6/6.
- Runtime dark mobile screenshot: `/tmp/meshdrop-route-status-badges-mobile-dark.png`.
- Visual verdict: `.omx/state/route-status-badges/ralph-progress.json` score 94/pass.
- `npm test` passed 356/356.
- `npm run test:e2e` passed browser transfer smoke.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0; it still reports existing `public/scripts/ui.js` size/duplicate code-quality warnings.

## Remaining Risk

Full-repo slop scan was not rerun for this narrow UI slice; existing baseline warnings remain outside this badge polish.
