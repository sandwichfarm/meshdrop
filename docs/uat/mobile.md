# Mobile UAT Runbook

Use this runbook for the dependency-free mobile source artifacts built by `npm run build:ios` and
`npm run build:android`.

## Build

1. Run `npm run build:ios -- --version <version>`.
2. Run `npm run build:android -- --version <version>`.
3. Confirm `dist/meshdrop-ios-<version>.tar.gz` and `dist/meshdrop-android-<version>.tar.gz` exist.
4. Confirm each archive contains `app/index.html`, `meshdrop-target.json`, a target README, and `UAT-MOBILE.md`.

## Artifact Acceptance

1. Confirm `meshdrop-target.json` reports `target` as `ios` or `android`.
2. Confirm `meshdrop-target.json` reports `runtime.platform` as `mobile`.
3. Confirm `meshdrop-target.json` reports `runtime.hasBackend` as `false` and `runtime.sharedInstance` as `false`.
4. Confirm `meshdrop-target.json` reports `nativeShellBuilt` as `false`.
5. Confirm backend-only transports are not claimed: `localDiscovery`, `pollen`, and `fips` are `false`.
6. Confirm `bluetooth` is `false` until a real mobile Bluetooth transport is implemented and tested.
7. Confirm browser-backed transports are available for a future shell: `webrtc`, `nostr`, `blossom`, and `hashtree` are `true`.

## Native Mobile Acceptance

1. Build a native iOS or Android shell from the matching source artifact.
2. Install the app on a physical device or emulator that supports WebRTC.
3. Confirm the app reads `meshdrop-target.json` and exposes `capabilities.runtime.target` as `ios` or `android`.
4. Configure a Nostr identity and transfer a small file over Nostr WebRTC to another MeshDrop peer.
5. Confirm the mobile file picker and share sheet can initiate a send.
6. Confirm Bluetooth remains hidden or disabled until implemented and negotiated.
7. Rebuild the app from a clean checkout before claiming the target is reproducible.

## Automated Smoke

Run:

```sh
npm run build:ios -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
npm run build:android -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-mobile-smoke
node --test test/mobile-package.test.js
```

This smoke proves source artifact shape, target metadata, runtime capability metadata, and the current proof boundary.

## Not Proven

- These source artifacts do not prove native iOS or Android shells exist.
- These source artifacts do not prove signed app-store packages or installable mobile binaries.
- These source artifacts do not prove mobile WebRTC transfer UAT.
- These source artifacts do not prove Bluetooth transport support.
