# Quick Task Summary: Android Rust FIPS Core Proof

## Result

Complete. Installed Android APK proof now exercises release-built Android `fips` and `fipsctl` binaries from the app
native library directory. `/fips/status` is served by `android-native-fipsctl` with `rustCore=true`; Pollen still uses the
packaged Android `pln` backend in the same installed APK smoke.

## FIPS Worktree

- Path: `/home/sandwich/Develop/fips-android-core-20260706`
- Branch: `agent/android-core-20260706`
- Commit: `c053661ad4f8033cf749ccf49d47d008031a2afd`
- PR: https://github.com/jmcorgan/fips/pull/124
- Scope: Android compile support for `fips` and `fipsctl`; Android stubs for unsupported raw Ethernet/TUN/LAN discovery
  paths; Android-safe STUN interface enumeration and DNS index conversion.

## MeshDrop Evidence

- `MESHDROP_ANDROID_AVD='Medium_Phone_API_36.1' MESHDROP_ANDROID_FIPS_X86_64=/home/sandwich/Develop/fips-android-core-20260706/target/x86_64-linux-android/release/fips MESHDROP_ANDROID_FIPSCTL_X86_64=/home/sandwich/Develop/fips-android-core-20260706/target/x86_64-linux-android/release/fipsctl MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-fips-pollen`
  - Passed: `Proof android-fips-pollen: farm.sandwich.meshdrop/.MainActivity served FIPS status from android-native-fipsctl with rustCore=true, Pollen android-native-pln uploaded/downloaded af5720edddfb17622e7bc374cac6a266da7e29fa9e7167b5aaffa56fadc94a48 via http://127.0.0.1:36417 on emulator-5580`
- `MESHDROP_ANDROID_FIPS_X86_64=/home/sandwich/Develop/fips-android-core-20260706/target/x86_64-linux-android/release/fips MESHDROP_ANDROID_FIPSCTL_X86_64=/home/sandwich/Develop/fips-android-core-20260706/target/x86_64-linux-android/release/fipsctl MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-apk`
  - Passed: `Proof android-apk-build: built meshdrop-android-apk-0.0.0-smoke.tar.gz with 46557751 byte debug APK`
- `MESHDROP_ANDROID_FIPS_X86_64=/home/sandwich/Develop/fips-android-core-20260706/target/x86_64-linux-android/release/fips MESHDROP_ANDROID_FIPSCTL_X86_64=/home/sandwich/Develop/fips-android-core-20260706/target/x86_64-linux-android/release/fipsctl MESHDROP_ANDROID_PLN_X86_64=/tmp/meshdrop-pln-android-x86_64 npm run test:android-release-apk`
  - Passed: `Proof android-release-apk-build: built meshdrop-android-release-apk-0.0.0-smoke.tar.gz with 43848294 byte UAT-signed release APK verified by apksigner`
- `node --test test/mobile-package.test.js test/uat-runbooks.test.js test/spa-runtime-config.test.js`
  - Passed: 13/13.
- `npm test`
  - Passed: 235/235.
- `git diff --check`
  - Passed.
- `npx --yes aislop scan --changes .`
  - Passed clean.
- `npx --yes aislop scan .`
  - Failed on existing full-repo baseline outside touched files: 56 warnings, including vendored noble-ciphers unused
    expressions, large files, duplicate blocks, and existing `server/nostr-identity.js` hardcoded URL warning.

## FIPS Evidence

- Android release cross-build:
  - `cargo build --release --target x86_64-linux-android --bin fips --bin fipsctl`
  - Passed with existing `activate_connected_udp_sessions` dead-code warning.
- Android debug cross-build:
  - `cargo build --target x86_64-linux-android --bin fips --bin fipsctl`
  - Passed with same warning.
- `cargo test`
  - Passed: lib 1369 passed, `fipsctl` 9 passed, `fipstop` 50 passed, doc-tests 0 passed/1 ignored.
- `cargo fmt --check && git diff --check`
  - Passed.

## Remaining Risk

- MeshDrop reproducibility depends on FIPS PR #124 until that Android build support lands upstream.
- Android proof is x86_64 emulator proof plus prior physical-device Android UAT for other installed APK surfaces; ARM64
  FIPS/Pollen native binaries were not built in this task.
