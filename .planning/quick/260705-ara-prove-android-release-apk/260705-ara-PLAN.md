# Prove Android Release APK

## Goal

Add a signed Android release APK artifact and proof that the produced APK is release-signed.

## Scope

- Add a build path for `meshdrop-android-release-apk-<version>.tar.gz`.
- Sign the release APK with a generated UAT keystore during the build.
- Verify the APK signature with Android build-tools before claiming proof.
- Add CI and release asset/readback wiring.
- Update mobile UAT docs and target status without claiming Play Store signing, physical-device UAT, picker UI UAT, or
  Bluetooth.

## Out of Scope

- Production signing keys or Play Store upload signing.
- Android App Bundle (`.aab`) output.
- Physical Android device install UAT.
- Android native picker UI selection.
- Bluetooth transport.

## Verification Plan

- Syntax checks for changed scripts.
- Focused package and UAT guard tests.
- `npm run test:android-release-apk`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` with baseline reported if still failing outside changed files.
