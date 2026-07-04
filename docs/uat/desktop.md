# Desktop Native UAT Runbook

Use this runbook for the dependency-free Desktop Native source artifact built by `npm run build:desktop`.

## Build

1. Run `npm run build:desktop -- --version <version>`.
2. Confirm `dist/meshdrop-desktop-<version>.tar.gz` exists.
3. Confirm the archive contains `app/index.html`, `meshdrop-target.json`, `README-DESKTOP.md`, and `UAT-DESKTOP.md`.

## Artifact Acceptance

1. Confirm `meshdrop-target.json` reports `target` as `desktop`.
2. Confirm `meshdrop-target.json` reports `runtime.platform` as `desktop`.
3. Confirm `meshdrop-target.json` reports `runtime.hasBackend` as `false` and `runtime.sharedInstance` as `false`.
4. Confirm `meshdrop-target.json` reports `nativeShellBuilt` as `false`.
5. Confirm backend-only transports are not claimed: `localDiscovery`, `pollen`, and `fips` are `false`.
6. Confirm `bluetooth` is `false` until a real desktop Bluetooth transport is implemented and tested.
7. Confirm browser-backed transports are available for a future shell: `webrtc`, `nostr`, `blossom`, and `hashtree` are `true`.

## Native Shell Acceptance

1. Build the desktop shell from this source artifact.
2. Launch MeshDrop from the native desktop app, not from a browser tab.
3. Confirm the app reads `meshdrop-target.json` and exposes `capabilities.runtime.target` as `desktop`.
4. Configure a Nostr identity and transfer a small file over Nostr WebRTC to another MeshDrop peer.
5. Confirm backend-only settings are absent unless a desktop backend is deliberately added and negotiated.
6. Confirm the installer or binary can be rebuilt from a clean checkout.

## Automated Smoke

Run:

```sh
npm run build:desktop -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
node --test test/desktop-package.test.js
npm run test:target-artifacts
```

This smoke proves source artifact shape, target metadata, runtime capability metadata, and a real Nostr WebRTC transfer
between two browser peers served from the generated desktop source artifact.

## Not Proven

- This source artifact does not prove a native desktop shell exists.
- This source artifact does not prove native desktop WebRTC transfer UAT.
- This source artifact does not prove a signed installer or native binary.
