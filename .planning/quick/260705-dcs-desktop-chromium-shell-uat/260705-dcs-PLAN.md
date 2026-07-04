---
status: complete
quick_id: 260705-dcs
slug: desktop-chromium-shell-uat
---

# Quick Task 260705-dcs: Desktop Chromium Shell UAT

## Goal

Add a Desktop Native-adjacent Chromium shell artifact that can prove a real Nostr WebRTC transfer with a desktop runtime
that exposes `RTCPeerConnection`, without re-enabling WebRTC claims for the GTK/WebKit shell.

## Scope

1. Extend desktop artifact building with a Chromium shell variant.
2. Package app assets plus a desktop launcher/server script that uses an installed Chromium-compatible browser.
3. Add a focused smoke that builds the artifact, runs the packaged shell server, and initiates a real Nostr WebRTC
   transfer between two desktop peers.
4. Update Desktop UAT docs and target status without claiming signed installers or bundled native engines.

## Out Of Scope

- Adding Electron/Tauri or new dependencies.
- Producing signed installers.
- Claiming GTK/WebKit WebRTC support.

## Validation

- `npm run test:desktop-chromium`
- `node --test test/desktop-package.test.js test/uat-runbooks.test.js`
- `npm test`
- `npm run test:target-artifacts`
- `git diff --check`
- `npx --yes aislop scan --changes .`
