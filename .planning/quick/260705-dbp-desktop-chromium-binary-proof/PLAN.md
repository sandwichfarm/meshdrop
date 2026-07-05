---
status: complete
created: 2026-07-05
slug: desktop-chromium-binary-proof
---

# Quick Task: Desktop Chromium Binary Proof

## Goal

Close the local Desktop Native binary-proof gap without claiming signed installer support.

## Scope

- Compile a Linux launcher binary for the Chromium desktop shell.
- Keep the existing Node shell script packaged as the launcher implementation.
- Make the manifest point at the binary executable and preserve script metadata.
- Prove the unpacked bundled Chromium artifact launches through the binary and transfers a file over Nostr WebRTC.
- Update the Desktop UAT runbook and target ledger to show only signed installer proof remains for the bundled Chromium desktop path.

## Out Of Scope

- Signed installer creation.
- Native GTK/WebKit WebRTC support.
- Start9, Umbrel, iOS, Android physical-device UAT.
- GHCR package visibility.

## Validation

- Red/green desktop package test.
- Bundled Desktop Chromium transfer smoke.
- Target UAT ledger guard.
- Repo tests, diff, and AI-slop gates.
