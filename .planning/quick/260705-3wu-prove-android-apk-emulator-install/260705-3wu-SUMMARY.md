---
status: complete
quick_id: 260705-3wu
slug: prove-android-apk-emulator-install
date: 2026-07-05
---

# Quick Task 260705-3wu: Prove Android APK emulator install

## Summary

- Added `npm run test:android-apk-install`.
- The smoke builds the Android debug APK artifact, installs it on an attached device or explicitly named AVD, resolves
  `farm.sandwich.meshdrop/.MainActivity`, launches the app, and confirms the activity is top.
- Updated mobile UAT docs and target status to record emulator install proof while keeping physical-device install,
  native Android transfer, file picker/share sheet, Bluetooth, and release signing open.

## Verification

- Manual preflight proved `Medium_Phone_API_36.1` boots headless/read-only on this host and can install/launch the APK.
- `npm ci` installed 87 packages and reported 0 vulnerabilities.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk-install`
  passed and emitted `Proof android-apk-emulator-install: installed meshdrop-android-apk-0.0.0-install-smoke.tar.gz
  on emulator-5580 (Android 16, x86_64) and launched farm.sandwich.meshdrop/.MainActivity`.
- `adb devices -l` showed no attached emulator after cleanup.
- `node --check scripts/android-apk-install-smoke.mjs` passed.
- `node --test test/uat-runbooks.test.js test/mobile-package.test.js` passed: 6/6.
- `npm test` passed: 188/188.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 `no-undef` browser global errors,
  3 existing `innerHTML` security findings in `public/scripts/ui.js`, 29 code-quality warnings, 57 AI-slop warnings,
  and 95 lint warnings.

## Remaining Gaps

- Physical Android device install UAT is not proven.
- Native Android WebRTC transfer UAT is not proven.
- Mobile file picker/share sheet integration is not proven.
- Bluetooth transport negotiation is not implemented or proven.
- Signed Android release APK/AAB proof is not complete.
