---
status: in_progress
created: "2026-07-07"
---

# Route Status No-Text DOM

## Goal

Remove fallback route-status words from the peer-card DOM when compact route badges are rendered, so visual glitches cannot expose wrapped status text.

## Plan

1. Keep existing Clearnet/FIPS/Pollen badge metadata and animations.
2. When route-attempt chips render, clear the peer-card `.status` text and mark it `aria-hidden`.
3. Put the route detail on the chip group and chips through ARIA/title metadata.
4. Verify with focused route-attempt tests, browser screenshot proof, repo tests, diff check, and changed-code slop scan.

## Verification

- `node --test test/route-attempts-ui.test.js`
- Browser DOM/screenshot proof on local server.
- `npm test`
- `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`
- `git diff --check`
- `npx --yes aislop scan --changes .`
