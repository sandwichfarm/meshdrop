# Android Share/File Input Summary

## Result

Added Android debug APK support for `ACTION_SEND`/`ACTION_SEND_MULTIPLE` share intents and WebView file chooser wiring.
Added `npm run test:android-share-file`, which installs the debug APK on an Android emulator, injects an Android
`ACTION_SEND` file stream, and proves the shared file is delivered to a Chromium peer over Nostr WebRTC.

## Verification

- `node --check public/scripts/ui-main.js && node --check scripts/mobile-native-source.mjs && node --check scripts/build-mobile-package.mjs && node --check scripts/android-webview-transfer-harness.mjs && node --check scripts/android-webview-transfer-smoke.mjs && node --check scripts/android-apk-smoke.mjs` passed.
- `node --test test/mobile-package.test.js test/uat-runbooks.test.js` passed: 6/6.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk` passed.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:android-share-file` passed and printed `Proof android-share-file-nostr-webrtc`.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:android-webview-transfer` passed and printed `Proof android-webview-nostr-webrtc`.
- `npm test` passed: 188/188.
- `PLAYWRIGHT_MODULE_PATH=/usr/lib/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors; it reports 2 complexity warnings in touched large files.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 460 browser-global `no-undef`
  errors, 3 `innerHTML` security errors in `public/scripts/ui.js`, 31 code-quality warnings, 57 AI-slop warnings,
  and 94 lint warnings.

## Not Proven

- Physical Android device install UAT.
- Android native file picker UI selection.
- Bluetooth transport negotiation.
- Signed Android release APK or AAB.
- Native iOS app/package and iOS file-picker/share-sheet integration.
