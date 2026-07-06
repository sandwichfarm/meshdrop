---
status: complete
quick_id: 260706-ux-toggle-groups
slug: ux-toggle-groups
date: 2026-07-06
---

# Summary: UX Toggle Groups

## Result

The shared web header now shows protocol controls as labeled groups instead of an undifferentiated icon strip. Identity,
Network, and Storage sections render from the common `public/index.html`, so Docker, SPA, desktop, and mobile targets
inherit the grouping when their capabilities expose those controls.

## Changed

- Wrapped Nostr identity, network postures, and storage routes in visible labeled groups.
- Labeled network controls as Instance, FIPS, Pollen, and Relay in that order.
- Labeled storage controls as Blossom and Hashtree.
- Preserved existing control IDs so the current controllers and target capability gates still own visibility/state.
- Added responsive header height rules so wrapped mobile protocol groups are not clipped.
- Added a focused markup regression test for group presence, order, and visible labels.

## Verification

- `node --test test/header-copy.test.js test/action-visibility.test.js` passed 29/29.
- Playwright visual proof against `http://127.0.0.1:3317` showed desktop groups: Identity/Nostr, Network/Instance/FIPS/Pollen/Relay, Storage/Blossom/Hashtree, with no overlap.
- Playwright mobile proof at 390px showed `clientHeight=164`, `scrollHeight=164`, and `scrollWidth=clientWidth=390`, so wrapped groups are not clipped or horizontally overflowing.
- `npm test` passed 243/243.
- `npm run test:e2e` passed browser transfer smoke.
- `npm run test:docker` passed Docker-served GUI/browser transfer smoke and two-host relay smoke.
- `git diff --check` passed.
- `npx --yes aislop scan . --exclude 'public/scripts/**' --exclude 'server/**' --exclude 'scripts/**'` passed clean over the changed test surface after excluding known baseline directories; this aislop version reported zero files for both `--changes` and `--staged`.
- `npx --yes aislop scan .` still fails the known baseline on pre-existing third-party lint warnings, duplicate blocks, large files, and `server/nostr-identity.js:11`.

## Remaining Risk

- The new visible short labels are English literals, matching the requested technical clarity but not localized.
- Full-repo AI-slop baseline remains failing outside this task.
