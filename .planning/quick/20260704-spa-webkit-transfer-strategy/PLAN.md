---
status: complete
created: 2026-07-04
slug: spa-webkit-transfer-strategy
---

# SPA WebKit Transfer Strategy

## Target

Move the SPA WebKit transfer UAT forward from repeated opaque page crashes toward an actually passing two-peer transfer
proof.

## Evidence

- Local forced WebKit cannot run because this host is missing Playwright `webkit-2311`, and AGENTS says not to install
  Playwright browsers here.
- Manual CI run `28715874289` installed WebKit and failed only the forced `SPA WebKit transfer UAT` job.
- Failure shape:
  - Attempt 1: sender/receiver debug failed because WebKit target crashed.
  - Attempt 2: receiver saw the sender as a Nostr peer, but sender stayed `have-local-offer` with no data channel.
  - Attempt 3: receiver hydration failed because WebKit target crashed.

## Plan

- Keep the existing one-context two-origin WebKit attempt.
- Add a two-context two-origin fallback attempt inside the same manual UAT command.
- Record the new CI run evidence in SPA UAT docs and target status only if it proves transfer or materially improves the
  failure evidence.

## Result

- Manual CI run `28716511864` passed on commit `8d396c10a92466a6706b8cd3593cc469aca6253f`.
- The `SPA WebKit transfer UAT` log includes
  `Proof backend-free-spa-nostr-webrtc:webkit: nostr delivered meshdrop-spa-proof.txt`.
- The passing run also restored normal CI coverage: unit tests, Docker smoke, browser transfer smoke, and SPA browser
  matrix for Chromium, Firefox, and WebKit all passed.

## Validation

- Focused SPA artifact guard.
- Manual GitHub `spa_webkit_transfer=true` workflow run.
- Standard repo gates if code changes are committed.
