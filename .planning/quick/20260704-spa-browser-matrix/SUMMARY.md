# SPA Browser Matrix Summary

## Changed

- `test:spa-artifact` now honors `PLAYWRIGHT_BROWSER=chromium|firefox|webkit`.
- CI now has an `SPA browser matrix` job that installs each selected browser and runs the backend-free SPA transfer smoke.
- SPA UAT docs list local commands for each browser.
- Target status now treats browser-matrix SPA transfer smoke as automated proof and leaves public-relay UAT open.

## Verification

- Red proof: `node --test test/spa-artifact.test.js` failed before implementation because `PLAYWRIGHT_BROWSER` support was absent.
- `node --test test/spa-artifact.test.js test/uat-runbooks.test.js test/docker-smoke-script.test.js` passed: 5/5.
- Ruby YAML parse passed for `.github/workflows/docker-image.yml`.
- Local Chromium transfer proof passed:
  `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium PLAYWRIGHT_BROWSER=chromium npm run test:spa-artifact`.

## Local Gaps

- Local Firefox proof could not run because this host has Playwright cache `firefox-1509` while the installed Playwright
  package expects `firefox-1532`.
- Local WebKit proof could not run because no matching WebKit browser is installed in the local Playwright cache.
- PR CI installs the selected browser per matrix entry and is the authoritative Firefox/WebKit proof for this slice.
