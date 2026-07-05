---
status: complete
quick_id: 260705-abw
slug: android-webview-bluetooth-negotiation
date: 2026-07-05
---

# Quick Task 260705-abw Summary

## Result

- Installed Android WebView capability smoke now reads actual `navigator.bluetooth` and negotiated
  `RuntimeCapabilities.bluetoothCapabilities()` from inside the APK.
- Android APK and UAT-signed release APK metadata no longer list Android Bluetooth negotiation as remaining proof.
- Bluetooth transfer remains unsupported: runtime proof reports `Bluetooth API=undefined` on the local AVD and
  `Bluetooth transfer=false`.
- CI now runs the Android WebView capability smoke in the runtime-gated Android emulator job before picker UI proof.
- Split Android Gradle/APK build internals out of `scripts/build-mobile-package.mjs` to keep changed-code slop clean.

## Evidence

- Red proof: `npm run test:android-apk` failed before implementation because
  `Bluetooth transport negotiation` was still listed in Android APK remaining proof.
- `node --check scripts/build-mobile-package.mjs && node --check scripts/android-package-build.mjs && node --check scripts/android-webview-capability-smoke.mjs` passed.
- `npm run test:android-apk` passed and emitted `Proof android-apk-build`.
- `npm run test:android-release-apk` passed and emitted `Proof android-release-apk-build`.
- `node --test test/ci-workflow.test.js test/uat-runbooks.test.js test/mobile-package.test.js` passed 14/14.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-webview-capabilities` passed and emitted `Bluetooth API=undefined, Bluetooth transfer=false`.
- `npm test` passed 196/196.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean, 100/100.

## Baseline

- Full-repo `npx --yes aislop scan .` still fails on pre-existing baseline findings:
  417 `no-undef` lint errors, 3 existing `innerHTML` security findings, 31 code-quality warnings,
  57 AI-slop warnings, and 94 lint warnings.

## Remaining Gaps

- Physical Android device install UAT is not proven.
- Bluetooth file-transfer implementation and transfer UAT remain unproven.
