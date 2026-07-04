# Static SPA UAT Runbook

Use this runbook for the no-backend browser target shipped as `meshdrop-spa-<version>.tar.gz`.

## Build

1. Run `npm run build:spa -- --version <version>`.
2. Confirm `dist/meshdrop-spa-<version>.tar.gz` exists.
3. Confirm the archive contains `index.html`, `scripts/runtime-capabilities.js`, `meshdrop-target.json`, and `UAT-SPA.md`.

## Serve

1. Unpack the artifact on a static host.
2. Serve the unpacked directory with history fallback to `index.html`.
3. Do not provide `/config`, `/server`, WebSocket, FIPS, Pollen, or local-discovery backend endpoints.

## Browser Acceptance

1. Open the static site in Chromium, Firefox, or Safari.
2. Confirm the page loads without browser console errors.
3. Confirm runtime capability state is `target: spa`, `hasBackend: false`, and `sharedInstance: false`.
4. Confirm local discovery, FIPS discovery, Pollen transfer, and server settings controls are hidden.
5. Connect a Nostr identity and confirm Nostr-backed WebRTC discovery controls remain available.
6. Transfer a small file between two browsers using a backend-free supported path before claiming the SPA target works for file sharing.

## Automated Smoke

Run:

```sh
PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium PLAYWRIGHT_BROWSER=chromium npm run test:spa-artifact
PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_BROWSER=firefox npm run test:spa-artifact
PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_BROWSER=webkit npm run test:spa-artifact
```

The smoke builds the tarball, unpacks it, serves it as a static site, and proves each selected browser negotiates the
no-backend SPA runtime. Chromium and Firefox also connect two Nostr identities through a test relay and transfer
`meshdrop-spa-proof.txt` over WebRTC without backend endpoints. WebKit currently proves packaged runtime compatibility
only because Playwright WebKit crashes during the two-page WebRTC transfer proof on GitHub Actions.

CI runs the `SPA browser matrix` job for Chromium, Firefox, and WebKit. Treat the Chromium and Firefox legs as transfer
proof and the WebKit leg as no-backend packaged-runtime proof.

To attempt the missing WebKit transfer UAT explicitly, run:

```sh
MESHDROP_SPA_WEBKIT_TRANSFER=1 PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_BROWSER=webkit npm run test:spa-artifact
```

Passing output must include `Proof backend-free-spa-nostr-webrtc:webkit: nostr delivered meshdrop-spa-proof.txt`.
Until that proof passes, WebKit remains runtime-only and the SPA target remains incomplete for WebKit transfer.

## Public Relay UAT

The default automated smoke uses an in-process relay so CI remains deterministic. To prove the backend-free SPA path
against public Nostr infrastructure, run the same artifact smoke with explicit relay URLs:

```sh
MESHDROP_SPA_PUBLIC_RELAY_URLS=wss://bucket.coracle.social \
  PLAYWRIGHT_MODULE_PATH= \
  PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium \
  PLAYWRIGHT_BROWSER=chromium \
  npm run test:spa-artifact
```

Passing output must include `Proof public-spa-nostr-webrtc:<browser>: nostr delivered meshdrop-spa-proof.txt`.

For GitHub-hosted proof, dispatch the `CI` workflow manually with `spa_public_relay_urls` set to one or more relay URLs.
The manual-only `SPA public relay UAT` job runs Chromium and Firefox, installs the matching Playwright browser, and
does not run on normal PR or push events.

Current public relay proof: manual CI run `28713488687` passed the Chromium and Firefox `SPA public relay UAT` jobs
against `wss://bucket.coracle.social` and both logs include `meshdrop-spa-proof.txt` delivery.

## WebKit Transfer UAT

The normal CI WebKit leg is intentionally runtime-only because historical GitHub-hosted Playwright WebKit runs crashed
during the two-page transfer proof. To retry that proof in GitHub Actions without making every PR flaky, dispatch the
`CI` workflow manually with `spa_webkit_transfer` set to `true`.

Passing output must include `Proof backend-free-spa-nostr-webrtc:webkit: nostr delivered meshdrop-spa-proof.txt`.
No current WebKit transfer proof is recorded.

Current failed WebKit transfer attempts:

- Manual CI run `28713995244` reached the forced WebKit transfer job after PR #35 and failed with WebKit page crashes
  and transfer wait timeouts.
- Manual CI run `28714194498` retried with separate WebKit browser processes after PR #36 and still crashed during
  runtime or receiver hydration.
- Manual CI run `28714388605` retried with one WebKit context and two static origins after PR #37 and still crashed
  during sender or receiver hydration.

In all three runs, the normal WebKit `SPA browser matrix` runtime smoke passed, so the open gap is the two-peer
WebKit WebRTC transfer proof, not packaged SPA runtime boot.
