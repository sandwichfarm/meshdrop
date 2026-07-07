---
status: complete
slug: 260707-route-status-compact-badges
completed: 2026-07-07
---

# Compact Route Status Badges Summary

Peer-card availability badges now render route icons without visible words. Clearnet blocked states keep low-opacity crossed-out styling, and pending FIPS/Pollen badges get the existing pulse plus an icon ring animation. Accessible route detail remains in `title` and `aria-label`.

Verification:
- `node --test test/route-attempts-ui.test.js` passed after red failure for missing icon-only availability helper and CSS hooks.
- `node --test test/ci-workflow.test.js` failed red for missing Playwright apt-feed hardening before the CI workflow patch.
- `MESH_DROP_CACHE_VERSION=v1.11.8-route-compact-badges npm run build:service-worker` passed and updated the service-worker cache id.
- `node --test test/route-attempts-ui.test.js test/peer-availability-protocol.test.js test/service-worker-version.test.js test/ui-safe-dom.test.js` passed 28/28.
- Browser proof on local `node server/index.js --localhost-only` passed with no page errors: status text visually hidden, active availability row hidden, 3 visible route-attempt icons, no visible chip text, Clearnet blocked, FIPS/Pollen pending.
- Screenshot written to `/tmp/meshdrop-route-status-compact-20260707.png`.
- `npm test` passed 360/360 after the CI workflow hardening test was added.
- `node --test test/ci-workflow.test.js test/docker-smoke-script.test.js test/spa-artifact.test.js` passed 15/15 after stripping flaky runner Microsoft apt feeds before Playwright dependency installs in `.github/workflows/docker-image.yml`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes --base origin/master .` exited 0 with 0 AI-slop/security/lint issues; it still reports pre-existing `public/scripts/ui.js` size/duplicate code-quality warnings.
- `npx --yes aislop scan --changes .` and `npx --yes aislop scan --staged .` both exited 0 but reported 0 files, so branch-base scan was used for changed-code evidence.

Known gaps:
- Full-repo `npx --yes aislop scan .` remains baseline failing outside this slice: vendored noble-ciphers unused-expression warnings, large files/duplicate blocks, `server/nostr-identity.js` hardcoded URL warning, vendored TODO/empty-function info.
- PR CI initially failed before repo smoke code because `npx playwright install --with-deps chromium` hit broken GitHub runner Microsoft apt feeds (`NOSPLIT`) in Docker/desktop/target jobs. The workflow now removes those optional feeds before Playwright dependency installs.
