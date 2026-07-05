---
status: complete
created: 2026-07-05
slug: desktop-chromium-bundled-engine
---

# Quick Task: Desktop Chromium Bundled Engine

## Goal

Close the Desktop Native “bundled Chromium engine” proof gap by producing a Chromium shell artifact that can carry and
prefer its own Chromium executable.

## Scope

- Add an opt-in bundled Chromium path for the desktop Chromium artifact builder.
- Teach the packaged launcher to prefer `bin/chromium/chrome` before system browsers.
- Add deterministic unit coverage with a fake engine directory.
- Add a real smoke that builds the bundled artifact from the installed Playwright Chromium and transfers a file over
  Nostr WebRTC using that bundled executable.
- Update Desktop UAT and target-status docs without claiming signed installer proof.

## Out Of Scope

- Signed installers.
- Electron/Tauri adoption.
- GTK/WebKit WebRTC enablement.
- Cross-platform bundled-browser packaging beyond the Linux Chromium path used by CI/UAT.

## Validation

- Red/green focused desktop package test.
- Bundled Chromium transfer smoke.
- UAT docs guard.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
