---
status: complete
quick_id: 260706-amber-nip04-webrtc
slug: amber-nip04-webrtc
date: 2026-07-06
---

# Quick Task 260706: Amber NIP-04 WebRTC Summary

## Result

Android Amber/NIP-55 login now exposes NIP-04 and NIP-44 encryption methods through the active MeshDrop identity signer, so Nostr WebRTC can pass its NIP-04 capability gate after Amber login.

## Root Cause

`NostrIdentityController.canEncrypt()` only checked `window.nostr.nip04`. Android Amber login uses the app's Android signer bridge instead of a browser `window.nostr` extension, so the Nostr WebRTC gate reported NIP-04 unavailable even when Amber could perform `nip04_encrypt` and `nip04_decrypt`.

## Changes

- Added NIP-04/NIP-44 encrypt/decrypt methods to the Android signer wrapper.
- Requested signer permissions during `get_public_key`.
- Stored and reused the selected Android signer package for later encryption requests.
- Routed identity encryption through the active signer instead of only `window.nostr`.
- Forwarded NIP-55 `permissions` through the Android native bridge.
- Added regression coverage for fresh Amber login and stored Amber identity encryption.

## Evidence

- `node --test test/action-visibility.test.js test/mobile-package.test.js` passed 30/30.
- `npm test` passed 222/222.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk` built the debug APK artifact.
- `npm run test:e2e` passed local, Blossom, Hashtree, FIPS, Pollen, Nostr WebRTC, and federated FIPS WebRTC browser smoke scenarios.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with no changed-code findings.

## Known Gaps

- Physical-device manual Amber approval for `nip04_encrypt`/`nip04_decrypt` was not exercised in this task.
- Full-repo AI-slop baseline still has pre-existing findings outside this change, including vendored noble library findings, existing duplicate blocks in `public/scripts/network.js`, and large-file/long-function baseline findings.
