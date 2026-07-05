# Run Android Picker UI In CI

## Goal

Make the Android native picker UI proof part of the CI surface so the project does not rely only on a local emulator
run after `npm run test:android-picker-ui` was added.

## Scope

- Add one GitHub Actions job that creates an Android API 36 AVD and runs `npm run test:android-picker-ui`.
- Keep the job separate from cheap APK artifact build checks because it boots an emulator and is runtime/UAT proof.
- Add a workflow unit test that asserts the CI job and command exist.

## Out of Scope

- Physical Android device UAT.
- Bluetooth negotiation.
- iOS picker/share-sheet UAT.
- Third-party workflow actions.

## Verification Plan

- `node --test test/ci-workflow.test.js`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` with baseline reported if still failing outside changed files.
- PR CI readback must show the Android picker UI emulator smoke job result.
