---
status: complete
completed: 2026-07-05
slug: desktop-chromium-bundled-engine
---

# Summary

Desktop Chromium artifacts can now include a bundled Chromium engine and prove file transfer through that packaged
browser executable.

## Changed

- Added opt-in `--bundle-chromium` support for `build:desktop:chromium-bundled`.
- Copied the selected Chromium executable directory into `bin/chromium/` and recorded bundled-engine metadata in
  `meshdrop-target.json`.
- Updated the Chromium desktop launcher to prefer `bin/chromium/chrome` before host-installed browsers.
- Added `npm run test:desktop-chromium-bundled`, which builds the bundled artifact and transfers
  `meshdrop-desktop-chromium-proof.txt` over Nostr WebRTC using the bundled executable.
- Added CI, Desktop UAT, and target-status coverage without claiming signed installer proof.

## Evidence

- Red proof: `node --test test/desktop-package.test.js` failed before implementation because
  `chromiumEngineBundled` was undefined.
- Focused proof passed: `node --test test/desktop-package.test.js test/ci-workflow.test.js test/uat-runbooks.test.js`
  11/11.
- Runtime proof passed: `npm run test:desktop-chromium` delivered `meshdrop-desktop-chromium-proof.txt`.
- Runtime proof passed: `npm run test:desktop-chromium-bundled` delivered `meshdrop-desktop-chromium-proof.txt` using
  bundled `bin/chromium/chrome`.
- Repo tests passed: `npm test` 194/194.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean: 100/100, no findings.
- `npx --yes aislop scan .` still fails on the known repo baseline: 417 `no-undef` lint errors, 3 direct `innerHTML`
  security errors, 42 console warnings, duplicate/size/long-function warnings, and vendor TODO/stub warnings.

## Remaining Risk

- Desktop signed installer or signed binary proof remains open.
- GTK/WebKit still correctly gates WebRTC off because its runtime lacks RTC APIs.
