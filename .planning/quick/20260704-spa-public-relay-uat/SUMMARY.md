# 20260704 SPA Public Relay UAT Summary

## Status

In progress.

## Implemented

- `scripts/spa-artifact-smoke.mjs` now signs Nostr mesh proof events with generated valid keys.
- The smoke keeps the local fake relay as the deterministic default.
- Setting `MESHDROP_SPA_PUBLIC_RELAY_URLS` switches the same smoke to public relay URLs.
- `.github/workflows/docker-image.yml` has a manual-only `SPA public relay UAT` job for Chromium and Firefox.
- `docs/uat/spa.md` documents local and GitHub-hosted public relay UAT commands.
- `docs/uat/target-status.md` records Chromium public relay UAT as proven and leaves Firefox public relay plus WebKit transfer open.

## Current Evidence

- `npm test` passed: 165/165.
- `git diff --check` passed.
- Workflow YAML parsed with Ruby.
- Local Chromium public relay proof passed against `wss://bucket.coracle.social`:
  `Proof public-spa-nostr-webrtc:chromium: nostr delivered meshdrop-spa-proof.txt`.

## Remaining

- GitHub-hosted manual public relay workflow readback for Firefox.
- WebKit transfer UAT remains open.
