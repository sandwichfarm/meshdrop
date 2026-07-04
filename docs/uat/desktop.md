# Desktop Native UAT Runbook

Use this runbook for the dependency-free Desktop Native source artifact built by `npm run build:desktop`, the Linux
GTK/WebKit native shell artifact built by `npm run build:desktop:native`, and the Chromium shell artifact built by
`npm run build:desktop:chromium`.

## Build

1. Run `npm run build:desktop -- --version <version>`.
2. Run `npm run build:desktop:native -- --version <version>`.
3. Run `npm run build:desktop:chromium -- --version <version>`.
4. Confirm `dist/meshdrop-desktop-<version>.tar.gz` exists.
5. Confirm `dist/meshdrop-desktop-linux-<version>.tar.gz` exists.
6. Confirm `dist/meshdrop-desktop-chromium-<version>.tar.gz` exists.
7. Confirm the source archive contains `app/index.html`, `meshdrop-target.json`, `README-DESKTOP.md`, and
   `UAT-DESKTOP.md`.
8. Confirm the GTK/WebKit native archive contains `app/index.html`, `bin/meshdrop-desktop`, `src/meshdrop-desktop.c`,
   `meshdrop-target.json`, `README-DESKTOP.md`, and `UAT-DESKTOP.md`.
9. Confirm the Chromium shell archive contains `app/index.html`, `bin/meshdrop-desktop-chromium.mjs`,
   `src/meshdrop-desktop-chromium.mjs`, `meshdrop-target.json`, `README-DESKTOP.md`, and `UAT-DESKTOP.md`.

## Artifact Acceptance

1. Confirm `meshdrop-target.json` reports `target` as `desktop`.
2. Confirm `meshdrop-target.json` reports `runtime.platform` as `desktop`.
3. Confirm `meshdrop-target.json` reports `runtime.hasBackend` as `false` and `runtime.sharedInstance` as `false`.
4. Confirm `meshdrop-target.json` reports `nativeShellBuilt` as `false`.
5. Confirm backend-only transports are not claimed: `localDiscovery`, `pollen`, and `fips` are `false`.
6. Confirm `bluetooth` is `false` until a real desktop Bluetooth transport is implemented and tested.
7. Confirm browser-backed transports are available for the source artifact: `webrtc`, `nostr`, `blossom`, and
   `hashtree` are `true`.
8. For the GTK/WebKit native Linux archive, confirm `meshdrop-target.json` reports `nativeShellBuilt` as `true`,
   `nativeShell.executable` as `bin/meshdrop-desktop`, and `nativeShell.toolkit` as `gtk4-webkitgtk`.
9. For the GTK/WebKit native Linux archive, confirm `webrtc` and `nostr` are `false` until a native engine exposes
   `RTCPeerConnection` and a real native transfer UAT passes.
10. For the Chromium shell archive, confirm `nativeShellBuilt` and `chromiumShellBuilt` are `true`,
    `nativeShell.executable` is `bin/meshdrop-desktop-chromium.mjs`, and `nativeShell.toolkit` is `chromium`.
11. For the Chromium shell archive, confirm `webrtc` and `nostr` are `true` only after
    `npm run test:desktop-chromium` passes.

## Native Shell Acceptance

1. Extract `meshdrop-desktop-linux-<version>.tar.gz`.
2. Launch MeshDrop from `bin/meshdrop-desktop --app-dir app`, not from a browser tab.
3. Confirm the app reads `meshdrop-target.json` and exposes `capabilities.runtime.target` as `desktop`.
4. Confirm backend-only settings are absent unless a desktop backend is deliberately added and negotiated.
5. Confirm the installer or binary can be rebuilt from a clean checkout.
6. Do not claim native WebRTC transfer support until the native shell exposes `RTCPeerConnection` and transfers a file
   to another MeshDrop peer.

## Chromium Shell Acceptance

1. Extract `meshdrop-desktop-chromium-<version>.tar.gz`.
2. Launch MeshDrop from `node bin/meshdrop-desktop-chromium.mjs --app-dir app`.
3. Confirm the app reads `meshdrop-target.json` and exposes `capabilities.runtime.target` as `desktop`.
4. Confirm the runtime exposes `RTCPeerConnection`.
5. Confirm `npm run test:desktop-chromium` transfers `meshdrop-desktop-chromium-proof.txt` over Nostr WebRTC.
6. Do not claim signed installer or bundled Chromium proof until an installer/bundled-engine artifact exists.

## Automated Smoke

Run:

```sh
npm run build:desktop -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
npm run build:desktop:native -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
npm run build:desktop:chromium -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
node --test test/desktop-package.test.js
npm run test:desktop-native
npm run test:desktop-chromium
npm run test:target-artifacts
```

This smoke proves source artifact shape, target metadata, native Linux shell compilation, native shell config readback,
native runtime capability metadata, GTK/WebKit WebRTC gating, Chromium shell WebRTC transfer, and a real Nostr WebRTC
transfer between two browser peers served from the generated desktop source artifact.

## Not Proven

- The GTK/WebKit native shell does not expose `RTCPeerConnection` in current UAT, so native desktop WebRTC transfer UAT
  remains open.
- The Chromium shell does not prove a signed installer or bundled Chromium engine.
