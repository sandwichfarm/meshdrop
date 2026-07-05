---
status: complete
quick_id: 260705-asa
slug: android-safe-area-and-signer-options
date: 2026-07-05
---

# Summary

Android WebView now uses viewport safe-area padding, keeps Nostr login reachable without NIP-07, exposes Remote Signer as the baseline path, and exposes Open in Amber when an Android NIP-55 signer is installed.

## Changes

- Added Android network and Wi-Fi manifest permissions plus a `nostrsigner:` query and native JavaScript bridge.
- Added Nostr login method selection with Browser Extension, Remote Signer, and Android signer choices based on runtime availability.
- Moved Android signer and npub parsing helpers into small standalone scripts loaded before the identity controller.
- Kept FIPS and Pollen controls visible when runtime config says those backend transports are supported but temporarily unavailable.
- Added safe-area CSS and `viewport-fit=cover` for the top Android system bar.
- Fixed physical-device Android launch detection to use explicit `MainActivity` start plus `ResumedActivity` readback.

## Evidence

- `node --check public/scripts/nostr-pubkey.js && node --check public/scripts/nostr-android-signer.js && node --check public/scripts/nostr-login-dialog.js && node --check public/scripts/nostr-identity.js && node --check scripts/mobile-native-source.mjs`
- `node --test test/action-visibility.test.js test/mobile-package.test.js` -> 28/28 pass
- `node --check scripts/e2e-smoke.mjs && npm run test:e2e`
  - Proof: local, Blossom, Hashtree, FIPS, Pollen, Nostr, and federated FIPS browser transfers passed
- `npm test` -> 220/220 pass
- `git diff --check`
- `npx --yes aislop scan --changes .` -> exits 0; initial app changes clean, final e2e assertion touch reports pre-existing style warnings on the large `scripts/e2e-smoke.mjs`
- `MESHDROP_ANDROID_SERIAL=28031FDH300BS5 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-webview-capabilities`
  - Proof: `farm.sandwich.meshdrop/.MainActivity exposed RTCPeerConnection=function, WebSocket=function, RTCDataChannel label=meshdrop-probe`
- Live Android WebView CDP snapshot on `28031FDH300BS5`
  - `bridge: true`
  - `amber: true`
  - `nostrButtonHidden: false`
  - `loginMethods: ["remote-signer","android-signer"]`
  - `safeAreaHeaderPadding: "50px"`
  - `viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover"`
  - `webRtc: "function"`
  - `webSocket: "function"`
  - `online: true`

## Known Gaps

- Full-repo AI-slop baseline still fails on pre-existing warnings outside changed code: bundled noble-ciphers unused expressions/TODOs, large legacy scripts, duplicate blocks in `public/scripts/network.js`, `server/nostr-identity.js` hardcoded URL, and one unused `message` parameter.
- Changed-code AI-slop now reports style warnings on `scripts/e2e-smoke.mjs` because the CI expectation fix touches a pre-existing 1064-line smoke harness with long functions.
- Static Android APK has no MeshDrop backend service. FIPS/Pollen remain hidden there because runtime config reports no backend-only transport support; tests prove they remain visible when the backend config says those transports are supported but temporarily unavailable.
- Remote Signer baseline path is present, but NIP-46 pairing is still not implemented; it currently reports that remote signer pairing is not configured.
