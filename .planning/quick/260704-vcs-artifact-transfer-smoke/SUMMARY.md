---
status: complete
completed: 2026-07-04
slug: artifact-transfer-smoke
---

# Summary

Desktop, iOS, and Android source artifacts now have an automated static artifact transfer smoke.

The browser static-config path reads `/meshdrop-target.json` after `/config` falls back to static hosting, so generated
artifacts report their target runtime instead of always reporting `spa`.

`npm run test:target-artifacts` builds each source artifact, unpacks it, serves the artifact root, verifies the target
runtime metadata, and transfers one proof file over Nostr WebRTC through a local fake relay.

## Evidence

- Red proof: `node --test test/spa-runtime-config.test.js` failed before implementation because static fallback did not
  request `/meshdrop-target.json`.
- `node --test test/spa-runtime-config.test.js test/desktop-package.test.js test/mobile-package.test.js test/uat-runbooks.test.js`
  passed: 8/8.
- `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:target-artifacts`
  passed and logged desktop, iOS, and Android Nostr WebRTC proof-file delivery.
- `npm test` passed: 174/174.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with only existing touched-file `network.js` size/duplicate/unused-class
  warnings.
- `npx --yes aislop scan .` still exits nonzero on the existing repo-wide baseline: browser global `no-undef` errors,
  `public/scripts/ui.js` direct `innerHTML` security findings, console/trivial-comment warnings, duplicate-code warnings,
  and file-size warnings.

## Not Proven

- Native desktop shell build, installer/binary, and native desktop transfer UAT.
- Native iOS/Android shells, app packages, file-picker/share-sheet integration, Bluetooth negotiation, and native mobile
  transfer UAT.
- GHCR anonymous package visibility.
