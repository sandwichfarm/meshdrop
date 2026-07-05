# Run Android Picker UI In CI Summary

## Result

- Added a dedicated `Android picker UI emulator smoke` GitHub Actions job.
- The job creates an Android API 36 AVD with SDK tools and runs `npm run test:android-picker-ui`.
- The Android runtime helper now allows CI to extend emulator boot wait time through `MESHDROP_ANDROID_BOOT_TIMEOUT_MS`,
  pins CI to the common `emulator-5554` serial, and reports captured emulator launch output when ADB never sees the device.
- The CI AVD creation step now persists `ANDROID_AVD_HOME` into `$GITHUB_ENV` so the smoke step launches the same AVD
  that `avdmanager` created.
- Added a workflow unit test that asserts the CI job, AVD setup, environment, and picker command remain present.

## Evidence

- `node --test test/ci-workflow.test.js` passed: 6/6.
- `node --check scripts/android-apk-runtime-utils.mjs && node --check scripts/android-picker-ui-smoke.mjs` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml` passed.
- `npm test` passed after dependencies were installed: 190/190.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors.
- `npx --yes aislop scan .` ran and failed on existing full-repo baseline: 460 `no-undef` lint errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, 33 code-quality warnings, 57 AI-slop warnings, and 94 lint warnings.
- PR CI run `28734642765` proved the SDK path fix by creating the Android API 36 AVD; it failed while waiting 120s for
  `emulator-5580`, which this slice now raises to 300s for CI.
- PR CI run `28734780150` proved the longer wait was used but still never saw `emulator-5580`; this slice now uses
  `MESHDROP_ANDROID_EMULATOR_PORT=5554` and keeps emulator output for the next failure if launch still breaks.
- PR CI run `28734992594` exposed the emulator launch root cause: `Unknown AVD name [meshdrop_ci_api_36]` because the
  run step could not find the `.ini` written by the create step. This slice now exports a stable `ANDROID_AVD_HOME`.
- PR CI run `28735075112` proved the AVD now launches, but the helper treated a non-ready ADB row as enough and then
  failed a 1s `wait-for-device`. This slice now waits for an exact `emulator-5554 device` row inside the 300s budget.
- PR CI run `28735202479` passed, including `Android picker UI emulator smoke` in 4m23s.

## Not Proven

- Physical Android device install UAT.
- Bluetooth transport negotiation.
