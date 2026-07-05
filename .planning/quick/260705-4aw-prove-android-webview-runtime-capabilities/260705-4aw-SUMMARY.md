---
status: complete
quick_id: 260705-4aw
slug: prove-android-webview-runtime-capabilities
date: 2026-07-05
---

# Quick Task 260705-4aw: Prove Android WebView runtime capabilities

## Summary

- Enabled Android WebView DevTools inspection only for debuggable generated Android apps.
- Added `npm run test:android-webview-capabilities`.
- The smoke builds and installs the Android debug APK, launches `farm.sandwich.meshdrop/.MainActivity`, attaches to the
  WebView DevTools socket, and evaluates runtime primitives from inside the installed app.
- Refactored Android APK smoke helpers so install and capability smokes share build/install/emulator logic.
- Updated APK metadata, mobile UAT docs, target status, and tests to record WebView capability evidence separately from
  native Android file-transfer proof.

## Verification

- `npm ci` installed 87 packages and reported 0 vulnerabilities.
- `node --check scripts/android-apk-runtime-utils.mjs && node --check scripts/android-apk-install-smoke.mjs && node --check scripts/android-webview-capability-smoke.mjs` passed.
- `node --test test/mobile-package.test.js test/uat-runbooks.test.js` passed: 6/6.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk`
  passed and emitted `Proof android-apk-build: built meshdrop-android-apk-0.0.0-smoke.tar.gz with 12345136 byte debug APK`.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-webview-capabilities`
  passed and emitted `Proof android-webview-capabilities: farm.sandwich.meshdrop/.MainActivity exposed RTCPeerConnection=function, WebSocket=function, RTCDataChannel label=meshdrop-probe, manifest target=android, native transfer claim=false on emulator-5580`.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk-install`
  passed after the helper refactor and emitted the Android 16 x86_64 install/launch proof.
- `adb devices -l` showed no attached emulator after cleanup.
- `npm test` passed: 188/188.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 `no-undef` browser global errors,
  3 existing `innerHTML` security findings in `public/scripts/ui.js`, 29 code-quality warnings, 57 AI-slop warnings,
  and 95 lint warnings.

## Remaining Gaps

- Native Android file transfer UAT is not proven.
- Physical Android device install UAT is not proven.
- Mobile file picker/share sheet integration is not proven.
- Bluetooth transport negotiation is not implemented or proven.
- Signed Android release APK/AAB proof is not complete.
