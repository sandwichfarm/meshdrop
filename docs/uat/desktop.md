# Desktop Native UAT Runbook

Use this runbook for the dependency-free Desktop Native source artifact built by `npm run build:desktop`, the Linux
GTK/WebKit native shell artifact built by `npm run build:desktop:native`, the Chromium shell artifact built by
`npm run build:desktop:chromium`, and the bundled Chromium shell artifact built by
`npm run build:desktop:chromium-bundled`. It also covers the signed Linux installer artifact built by
`npm run build:desktop:installer`.

## Build

1. Run `npm run build:desktop -- --version <version>`.
2. Run `npm run build:desktop:native -- --version <version>`.
3. Run `npm run build:desktop:chromium -- --version <version>`.
4. Run `npm run build:desktop:chromium-bundled -- --version <version>` when validating a bundled Chromium engine.
5. Run `npm run build:desktop:installer -- --version <version>` when validating a signed installer.
6. Confirm `dist/meshdrop-desktop-<version>.tar.gz` exists.
7. Confirm `dist/meshdrop-desktop-linux-<version>.tar.gz` exists.
8. Confirm `dist/meshdrop-desktop-chromium-<version>.tar.gz` exists.
9. Confirm `dist/meshdrop-desktop-chromium-bundled-<version>.tar.gz` exists.
10. Confirm `dist/meshdrop-desktop-chromium-bundled-installer-<version>.run`,
   `dist/meshdrop-desktop-chromium-bundled-installer-<version>.run.asc`,
   `dist/meshdrop-desktop-chromium-bundled-installer-<version>.run.sha256`, and
   `dist/meshdrop-desktop-chromium-bundled-installer-<version>.run.pubkey.asc` exist.
11. Confirm the source archive contains `app/index.html`, `meshdrop-target.json`, `README-DESKTOP.md`, and
   `UAT-DESKTOP.md`.
12. Confirm the GTK/WebKit native archive contains `app/index.html`, `bin/meshdrop-desktop`, `src/meshdrop-desktop.c`,
   `meshdrop-target.json`, `README-DESKTOP.md`, and `UAT-DESKTOP.md`.
13. Confirm the Chromium shell archive contains `app/index.html`, `bin/meshdrop-desktop-chromium`,
   `bin/meshdrop-desktop-chromium.mjs`, `src/meshdrop-desktop-chromium.c`,
   `src/meshdrop-desktop-chromium.mjs`, `meshdrop-target.json`, `README-DESKTOP.md`, and `UAT-DESKTOP.md`.
14. For the bundled Chromium shell archive, confirm `bin/chromium/chrome` exists.

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
    `nativeShell.executable` is `bin/meshdrop-desktop-chromium`, `nativeShell.binaryBuilt` is `true`, and
    `nativeShell.toolkit` is `chromium`.
11. For the Chromium shell archive, confirm `webrtc` and `nostr` are `true` only after
    `npm run test:desktop-chromium` passes.
12. For the non-bundled Chromium shell archive, confirm remaining proof lists `bundled Chromium engine` and
    `signed desktop installer`.
13. For the bundled Chromium shell archive, confirm `chromiumEngineBundled` is `true`,
    `nativeShell.chromiumExecutable` is `bin/chromium/chrome`, and remaining proof lists only
    `signed desktop installer`.
14. For the signed installer, confirm `--print-metadata` reports `target` as `desktop`, `signature` as
    `gpg-detached-armor`, and `remainingProof` as an empty list.
15. Confirm `sha256sum -c meshdrop-desktop-chromium-bundled-installer-<version>.run.sha256` passes.
16. Import `meshdrop-desktop-chromium-bundled-installer-<version>.run.pubkey.asc` into a clean GPG home and confirm
    `gpg --verify meshdrop-desktop-chromium-bundled-installer-<version>.run.asc
    meshdrop-desktop-chromium-bundled-installer-<version>.run` passes.

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
2. Launch MeshDrop from `bin/meshdrop-desktop-chromium --app-dir app`.
3. Confirm the app reads `meshdrop-target.json` and exposes `capabilities.runtime.target` as `desktop`.
4. Confirm the runtime exposes `RTCPeerConnection`.
5. Confirm `npm run test:desktop-chromium` transfers `meshdrop-desktop-chromium-proof.txt` over Nostr WebRTC.
6. Confirm `npm run test:desktop-chromium-bundled` transfers `meshdrop-desktop-chromium-proof.txt` using the packaged
   `bin/chromium/chrome` executable.
7. Confirm `npm run test:desktop-installer` verifies the installer signature, installs the package, and launches the
   installed Desktop Chromium shell.

## Automated Smoke

Run:

```sh
npm run build:desktop -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
npm run build:desktop:native -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
npm run build:desktop:chromium -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
npm run build:desktop:chromium-bundled -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
npm run build:desktop:installer -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-desktop-smoke
node --test test/desktop-package.test.js
npm run test:desktop-native
npm run test:desktop-chromium
npm run test:desktop-chromium-bundled
npm run test:desktop-installer
npm run test:target-artifacts
```

This smoke proves source artifact shape, target metadata, native Linux shell compilation, native shell config readback,
native runtime capability metadata, GTK/WebKit WebRTC gating, Chromium shell WebRTC transfer, bundled Chromium WebRTC
transfer, signed installer verification/install/launch, and a real Nostr WebRTC transfer between two browser peers
served from the generated desktop source artifact.

## Not Proven

- The GTK/WebKit native shell does not expose `RTCPeerConnection` in current UAT, so native desktop WebRTC transfer UAT
  remains open.
- The signed installer proof covers the Desktop Chromium shell path. It does not make the GTK/WebKit native shell claim
  native WebRTC transfer support.
