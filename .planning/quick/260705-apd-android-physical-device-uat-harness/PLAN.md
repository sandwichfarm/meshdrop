# Android Physical Device UAT Harness

## Objective

Add a deterministic physical Android device UAT harness that runs the existing Android install, WebView capability,
WebView transfer, share-intent transfer, and native picker UI smokes against real hardware only.

## Scope

- Add an npm script for physical Android hardware UAT.
- Fail closed when no physical ADB device is attached, when only emulators are attached, or when multiple physical
  devices require an explicit serial.
- Keep target status honest: the harness exists, but physical-device UAT remains open until the harness passes on
  hardware.

## Verification

- `node --test test/android-physical-device-uat.test.js test/uat-runbooks.test.js`
- `node --check scripts/android-physical-device-uat.mjs`
- `npm run test:android-physical-device` fail-closed proof when no device is attached
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
