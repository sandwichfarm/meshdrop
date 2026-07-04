---
status: complete
completed: 2026-07-05
slug: desktop-native-linux-shell
---

# Summary: Desktop Native Linux Shell

## Result

Desktop Native now has a compiled Linux GTK/WebKit shell artifact instead of only a source tarball.

## Changed

- Added `packaging/desktop/meshdrop-desktop.c`, a small GTK/WebKit shell that loads the packaged MeshDrop app assets.
- Added `npm run build:desktop:native`, producing `meshdrop-desktop-linux-<version>.tar.gz`.
- Updated the desktop package builder so source artifacts remain source-only while native artifacts set
  `nativeShellBuilt: true` and include `bin/meshdrop-desktop`.
- Added test coverage that extracts the native tarball and runs the binary in `--meshdrop-print-config` mode.
- Added GTK/WebKit system package installs to CI and release jobs.
- Added the native Linux desktop tarball to release creation and release readback.
- Updated UAT docs and target status without claiming native desktop transfer UAT or signed installer proof.

## Evidence

- Red proof: `node --test test/desktop-package.test.js` failed before `buildDesktopNativePackage` existed.
- Local toolchain proof: `pkg-config` reported GTK 4.22.4 and WebKitGTK 2.52.4 on this host.
- `node --test test/desktop-package.test.js test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js`
  passed, 9/9.
- `npm run build:desktop:native -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-native-smoke` produced
  `/tmp/meshdrop-desktop-native-smoke/meshdrop-desktop-linux-0.0.0-smoke.tar.gz`.
- Extracted artifact readback showed `app/index.html`, `bin/meshdrop-desktop`, `src/meshdrop-desktop.c`, and
  `meshdrop-target.json`.
- Extracted binary smoke returned `{"target":"desktop","nativeShellBuilt":true,"appIndexExists":true}`.
- `npm ci` passed with 0 vulnerabilities.
- YAML parse passed for `.github/workflows/docker-image.yml`, `.github/workflows/release.yml`, and
  `.github/workflows/release-verify.yml`.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml
  .github/workflows/release.yml .github/workflows/release-verify.yml` passed.
- `npm test` passed, 180/180.
- `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium
  npm run test:target-artifacts` passed and emitted desktop, iOS, and Android Nostr WebRTC proof-file delivery.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 `no-undef` errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, and existing style/slop warnings.

## Remaining Risk

- Native desktop WebRTC transfer through the GTK/WebKit window is not proven.
- Signed installer/native package proof is not done.
- iOS and Android native shells remain source-only.
