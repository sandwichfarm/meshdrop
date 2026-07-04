---
status: complete
quick_id: 260705-dcs
slug: desktop-chromium-shell-uat
completed_at: 2026-07-05
---

# Quick Task 260705-dcs Summary: Desktop Chromium Shell UAT

## Result

MeshDrop now builds a separate Desktop Chromium shell artifact,
`meshdrop-desktop-chromium-<version>.tar.gz`, alongside the existing source and GTK/WebKit artifacts.

The Chromium shell packages the app assets and desktop target manifest, serves them locally from the packaged launcher,
and proves a real Nostr WebRTC transfer through Chromium:

`Proof desktop-chromium-shell-nostr-webrtc: nostr delivered meshdrop-desktop-chromium-proof.txt`

The GTK/WebKit artifact still gates WebRTC and Nostr off because the packaged WebKit runtime does not expose RTC APIs.

## Changed

- Added `build:desktop:chromium`.
- Added the packaged launcher `bin/meshdrop-desktop-chromium.mjs`.
- Added `npm run test:desktop-chromium`, which builds the artifact, starts the packaged shell server, and transfers a proof file.
- Added CI coverage for the Desktop Chromium shell proof.
- Added release and release-readback wiring for `meshdrop-desktop-chromium-<version>.tar.gz`.
- Updated Desktop and target-status UAT docs without claiming a signed installer or bundled browser engine.

## Verification

- `node --test test/desktop-package.test.js` passed: 3/3.
- `npm run test:desktop-chromium` passed and delivered `meshdrop-desktop-chromium-proof.txt`.
- `node --test test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js` passed: 9/9.
- `npm test` passed: 187/187.
- `npm run test:target-artifacts` passed for Desktop, iOS, and Android source artifacts.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.

## Remaining Gaps

- Signed Desktop Native installer or installable package proof remains open.
- Bundled Chromium/native engine proof remains open; this artifact requires a compatible system Chromium path.
- GTK/WebKit native shell WebRTC remains intentionally unsupported until that runtime exposes RTC APIs.
