---
status: complete
slug: 260707-route-status-compact-badges
completed: 2026-07-07
---

# Compact Route Status Badges Summary

Peer-card availability badges now render route icons without visible words. Clearnet blocked states keep low-opacity crossed-out styling, and pending FIPS/Pollen badges get the existing pulse plus an icon ring animation. Accessible route detail remains in `title` and `aria-label`.

Verification:
- `node --test test/route-attempts-ui.test.js` passed after red failure for missing icon-only availability helper and CSS hooks.
- `MESH_DROP_CACHE_VERSION=v1.11.8-route-compact-badges npm run build:service-worker` passed and updated the service-worker cache id.
- `node --test test/route-attempts-ui.test.js test/peer-availability-protocol.test.js test/service-worker-version.test.js test/ui-safe-dom.test.js` passed 28/28.
- Browser proof on local `node server/index.js --localhost-only` passed with no page errors: status text visually hidden, active availability row hidden, 3 visible route-attempt icons, no visible chip text, Clearnet blocked, FIPS/Pollen pending.
- Screenshot written to `/tmp/meshdrop-route-status-compact-20260707.png`.
- `npm test` passed 359/359.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 AI-slop/security/lint issues; it still reports pre-existing `public/scripts/ui.js` size/duplicate code-quality warnings.

Known gaps:
- Full-repo `npx --yes aislop scan .` remains baseline failing outside this slice: vendored noble-ciphers unused-expression warnings, large files/duplicate blocks, `server/nostr-identity.js` hardcoded URL warning, vendored TODO/empty-function info.
