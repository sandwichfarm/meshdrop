# Prove Android Release APK Summary

## Result

- Added `meshdrop-android-release-apk-<version>.tar.gz`.
- Builds generated Android WebView native source with Gradle `assembleRelease`.
- Signs the APK with a generated UAT keystore for artifact proof.
- Verifies the staged APK with Android SDK `apksigner verify --print-certs`.
- Keeps Play Store upload signing, AAB output, physical-device UAT, native picker UI UAT, and Bluetooth out of scope.

## Evidence

- `node --check scripts/build-mobile-package.mjs && node --check scripts/mobile-native-source.mjs && node --check scripts/android-release-apk-smoke.mjs && node --check scripts/android-apk-smoke.mjs` passed.
- `node --test test/mobile-package.test.js test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js` passed: 16/16.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-release-apk` passed and emitted `Proof android-release-apk-build: built meshdrop-android-release-apk-0.0.0-smoke.tar.gz with 11792876 byte UAT-signed release APK verified by apksigner`.
- `ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" JAVA_HOME=/usr/lib/jvm/java-17-openjdk npm run test:android-apk` passed and emitted `Proof android-apk-build`.
- `npm ci` passed: 87 packages, 0 vulnerabilities.
- `npm test` passed: 189/189.
- YAML parse passed for `.github/workflows/docker-image.yml`, `.github/workflows/release.yml`, and `.github/workflows/release-verify.yml`.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml .github/workflows/release.yml .github/workflows/release-verify.yml` passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors and 3 warnings from existing large/long-file baseline touching changed files.
- `npx --yes aislop scan .` ran and failed on existing full-repo baseline: 460 `no-undef` lint errors, 3 `innerHTML` security errors in `public/scripts/ui.js`, 33 code-quality warnings, 57 AI-slop warnings, and 94 lint warnings.

## Remaining Proof

- Physical Android device install UAT.
- Android native file picker UI UAT.
- Bluetooth transport negotiation.
- Play Store upload signing and Android App Bundle output remain unimplemented and out of scope for this slice.
