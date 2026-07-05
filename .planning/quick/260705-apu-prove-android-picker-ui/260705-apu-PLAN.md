# Prove Android Picker UI

## Goal

Add deterministic proof that the generated Android WebView wrapper opens the native Android file picker UI and can
return a selected file to MeshDrop.

## Scope

- Add an Android emulator smoke that exercises a real `input[type=file]` click inside the installed APK.
- Drive Android's native picker UI through the emulator instead of treating source wiring as proof.
- Confirm the WebView receives the selected file metadata after the picker result.
- Update mobile UAT docs and target status to remove Android native picker UI UAT from remaining Android proof.
- Keep existing Android transfer, share-intent, debug APK, and release APK proofs intact.

## Out of Scope

- Physical Android device install UAT.
- Bluetooth transport negotiation.
- iOS picker/share-sheet UAT.
- Production Play Store signing or AAB output.

## Verification Plan

- Syntax checks for changed scripts.
- Focused package/UAT guard tests.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-picker-ui`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` with baseline reported if still failing outside changed files.
