---
status: complete
quick_id: 260706-android-fips-pollen-options
slug: android-fips-pollen-options
date: 2026-07-06
---

# Quick Task 260706: Android FIPS/Pollen Options Summary

## Result

Android APK target metadata now advertises FIPS and Pollen transport support. The packaged Android WebView static config enables those transports from the injected target manifest, so the FIPS and Pollen controls render in the Android build.

## Root Cause

The Android APK was built with a target manifest that hard-coded `transports.pollen` and `transports.fips` to `false`. The Android WebView therefore loaded a static config where both transport capabilities were unsupported, and the FIPS/Pollen controllers hid their controls.

## Changes

- Set Android debug/release APK target manifests to advertise FIPS and Pollen transport support.
- Propagated static target-manifest FIPS/Pollen transport flags into top-level static config enablement.
- Added static-config regression coverage for Android APK FIPS/Pollen transport options.
- Strengthened Android APK and Android WebView capability smokes to assert FIPS/Pollen support and visibility.

## Evidence

- Red proof before fix: `npm run test:android-apk` failed because Android APK manifest emitted `transports.pollen: false`.
- `node --test test/mobile-package.test.js test/spa-runtime-config.test.js test/action-visibility.test.js` passed 37/37.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk` passed.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk MESHDROP_ANDROID_AVD="Medium_Phone_API_36.1" npm run test:android-webview-capabilities` passed and reported `FIPS visible=true, Pollen visible=true`.
- `npm test` passed 223/223.
- `npm run test:e2e` passed local, Blossom, Hashtree, FIPS, Pollen, Nostr WebRTC, and federated FIPS WebRTC smoke scenarios.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with no changed-code findings.

## Known Gaps

- This task proves Android APK metadata and WebView option visibility. It does not prove a physical Android device can complete live FIPS/Pollen transfers.
- Full-repo AI-slop baseline remains failing on pre-existing findings outside this change: vendored noble lint/TODO findings, existing `public/scripts/network.js` duplicate/unused warnings, large-file/long-function findings, and the existing hardcoded URL warning in `server/nostr-identity.js`.
