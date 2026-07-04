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
PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact
```

The smoke builds the tarball, unpacks it, serves it as a static site, and proves the browser negotiates the no-backend SPA runtime.
