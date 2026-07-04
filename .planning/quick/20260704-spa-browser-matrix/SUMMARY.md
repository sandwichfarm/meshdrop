# SPA Browser Matrix Summary

## Changed

- `test:spa-artifact` now honors `PLAYWRIGHT_BROWSER=chromium|firefox|webkit`.
- CI now has an `SPA browser matrix` job that installs each selected browser and runs the SPA artifact smoke.
- Chromium and Firefox prove backend-free SPA Nostr WebRTC transfer in CI.
- WebKit proves packaged no-backend runtime behavior in CI; WebKit transfer UAT remains open because Playwright WebKit
  repeatedly crashed during the two-page transfer proof.
- SPA UAT docs list local commands for each browser.
- Target status now treats Chromium/Firefox SPA transfer smoke as automated proof and leaves WebKit transfer and
  public-relay UAT open.

## Verification

- Red proof: `node --test test/spa-artifact.test.js` failed before implementation because `PLAYWRIGHT_BROWSER` support was absent.
- `node --test test/spa-artifact.test.js test/uat-runbooks.test.js test/docker-smoke-script.test.js` passed: 5/5.
- Ruby YAML parse passed for `.github/workflows/docker-image.yml`.
- Local Chromium transfer proof passed:
  `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium PLAYWRIGHT_BROWSER=chromium npm run test:spa-artifact`.
- PR #29 merged at `27a2086`.
- PR CI run `28712787297` passed all jobs on head `21db873`.
- Master CI run `28713014340` passed all jobs on merge commit `c507330` after the Docker timeout follow-up fix.

## Local Gaps

- Local Firefox proof could not run because this host has Playwright cache `firefox-1509` while the installed Playwright
  package expects `firefox-1532`.
- Local WebKit proof could not run because no matching WebKit browser is installed in the local Playwright cache.
- PR CI installs the selected browser per matrix entry and is the authoritative Firefox/WebKit proof for this slice.
- WebKit transfer remains a real gap, not a completed proof.
