---
status: complete
completed: 2026-07-06
slug: android-pln-proof-and-fips-launch
---

# Summary

Android APK proof now exercises a packaged Android `pln` binary from inside the installed WebView. The generated Android
backend packages native tools as extracted `jniLibs`, starts `pln up --port 0` before Pollen requests, and routes
WebView Pollen upload/download through `android-native-pln` when `MESHDROP_ANDROID_PLN_*` supplies an Android binary.

FIPS completion remains unclaimed. The generated backend now has app-private config and daemon launch plumbing for
supplied Android `fips`/`fipsctl` binaries, but the current upstream FIPS source still fails to cross-build for Android.

## Changed

- Package Android native tools as `jniLibs/<abi>/libmeshdrop_<tool>.so` and execute them from `nativeLibraryDir`.
- Add Gradle legacy JNI extraction so packaged tool binaries can run on the emulator.
- Start packaged `pln` as a long-running process before `status`, `seed`, and `fetch`.
- Add FIPS daemon launch plumbing with app-private config/control socket paths before `fipsctl show status`.
- Update Android smoke proof, package tests, and UAT docs for `android-native-pln`.

## Evidence

- Focused tests passed: `node --test test/mobile-package.test.js test/uat-runbooks.test.js test/spa-runtime-config.test.js` 13/13.
- Repo tests passed: `npm test` 235/235.
- Android APK build with packaged `pln` passed: `MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-apk`.
- Installed Android WebView Pollen proof passed: `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-fips-pollen`.
- Android WebView capabilities proof passed with packaged `pln`: `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-webview-capabilities`.
- Android WebView transfer proof passed with packaged `pln`: `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-webview-transfer`.
- Android release APK build with packaged `pln` passed: `MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-release-apk`.
- Syntax checks passed: `node --check scripts/mobile-native-source.mjs && node --check scripts/android-fips-pollen-smoke.mjs`.
- `git diff --check` passed.
- Changed-code AI-slop passed: `npx --yes aislop scan --changes .` exited 0 with no findings.
- Full-repo AI-slop baseline still fails outside touched code: 56 warnings, led by vendored noble-ciphers unused
  expressions/TODOs, large legacy frontend files, duplicate code blocks, and one hardcoded URL warning in
  `server/nostr-identity.js`.

## Remaining Risk

- Native Android Rust FIPS core integration remains open. Cross-building `fips`/`fipsctl` for
  `x86_64-linux-android` still fails in upstream FIPS ethernet/TUN/DNS platform cfg/type paths after Android
  std/linker setup succeeds.
- The proved Pollen binary is local build artifact `/tmp/meshdrop-pln-android-x86_64`; this branch adds packaging and
  installed-APK proof, not a checked-in Android `pln` release artifact.
