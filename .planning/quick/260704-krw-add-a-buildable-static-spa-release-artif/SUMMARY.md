---
status: complete
completed: 2026-07-04T13:03:00Z
---

# Summary

Added a buildable no-backend SPA release artifact and UAT runbook.

The new `build:spa` script stages the `public/` app, stamps the staged service worker, adds `meshdrop-target.json` and `UAT-SPA.md`, then emits `meshdrop-spa-<version>.tar.gz`. The release workflow now adds that SPA tarball beside source and node artifacts for `v0.*.*` tags.

The SPA artifact smoke builds the tarball, unpacks it, serves it as a static host with fallback HTML for `/config`, and proves Chromium negotiates `target: spa`, `hasBackend: false`, hidden backend-only controls, and no browser console errors.

## Evidence

- `node --test test/spa-artifact.test.js` passed: 2/2.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed: 153/153.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact` passed.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed and proved local WebRTC, Blossom, Hashtree, FIPS WebRTC, Pollen WebRTC, Pollen storage, Nostr WebRTC, and federated FIPS WebRTC transfers.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke`.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml` passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline.

## Known Gaps

- A real `v0.*.*` tag was not created, so GitHub release upload was workflow-validated but not production-run.
- SPA WebRTC file transfer still needs public-relay/two-host UAT before claiming the target is fully complete.
- Start9, Umbrel, native desktop, and mobile targets remain incomplete.
