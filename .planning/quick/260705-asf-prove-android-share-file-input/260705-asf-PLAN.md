# Prove Android Share/File Input

## Goal

Prove the generated Android WebView APK can receive a mobile share/file-input payload and use it to start a real
MeshDrop send path to a peer.

## Scope

- Add generated Android WebView support for native share intents and WebView file chooser selection.
- Add an emulator smoke that installs the debug APK, injects a share/file payload, connects to a Chromium peer, and
  proves the shared file is delivered over Nostr WebRTC.
- Update mobile UAT docs and guards so Android share/file-input proof is recorded without overclaiming physical device,
  Bluetooth, release signing, or iOS support.

## Out of Scope

- Physical Android device UAT.
- Bluetooth transport implementation.
- Signed release APK or AAB.
- Native iOS app/package proof.

## Verification Plan

- Syntax checks for changed scripts.
- Focused mobile/UAT tests.
- Android emulator smoke for the native share/file-input transfer.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` with baseline reported if still failing outside changed files.
