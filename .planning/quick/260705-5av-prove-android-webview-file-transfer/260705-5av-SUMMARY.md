---
status: complete
quick_id: 260705-5av
slug: prove-android-webview-file-transfer
date: 2026-07-05
---

# Quick Task 260705-5av Summary

## Result

The installed Android debug APK WebView now has deterministic Nostr WebRTC file-transfer proof. The smoke builds and
installs the APK, attaches to Android WebView DevTools, connects an Android WebView peer to a Chromium peer through a
local fake relay, and sends `meshdrop-android-webview-proof.txt` from Android to Chromium.

Android APK target metadata now claims WebRTC and Nostr transfer support only for the debug APK path that has this
runtime proof. Native-source artifacts still gate native WebRTC/Nostr off.

## Verification

- `node --check scripts/android-webview-devtools.mjs && node --check scripts/android-webview-transfer-harness.mjs && node --check scripts/android-webview-transfer-smoke.mjs && node --check scripts/android-webview-capability-smoke.mjs && node --check scripts/android-apk-smoke.mjs && node --check scripts/mobile-native-source.mjs && node --check scripts/build-mobile-package.mjs`
- `node --test test/mobile-package.test.js test/uat-runbooks.test.js` passes: 6/6.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk` passes and emits `Proof android-apk-build: built meshdrop-android-apk-0.0.0-smoke.tar.gz with 12346061 byte debug APK`.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-webview-capabilities` passes and emits `native transfer claim=true`.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:android-webview-transfer` passes and emits `Proof android-webview-nostr-webrtc: farm.sandwich.meshdrop/.MainActivity delivered meshdrop-android-webview-proof.txt to Chromium peer through local fake relay on emulator-5580`.
- `npm test` passes: 188/188.
- `git diff --check` passes.
- `npx --yes aislop scan --changes .` passes clean.
- `npx --yes aislop scan .` runs and fails on the existing full-repo baseline: 460 `no-undef` browser global errors, 3 existing `innerHTML` security errors in `public/scripts/ui.js`, plus existing size, duplicate, console, comment, and unused warnings.
- `adb devices -l` shows no attached emulator after cleanup.

## Still Not Proven

- Physical Android device install UAT.
- Mobile file picker and share sheet integration.
- Bluetooth transport negotiation.
- Signed Android release APK or AAB package.
- Native iOS WebRTC transfer UAT.
