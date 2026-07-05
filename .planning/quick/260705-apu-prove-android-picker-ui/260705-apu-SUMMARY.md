# Prove Android Picker UI Summary

## Result

- Added `npm run test:android-picker-ui`.
- The smoke installs the generated Android debug APK on an emulator, opens a real WebView file input, drives Android's
  native picker UI, selects `meshdrop-picker-proof.txt`, and confirms the WebView receives the selected file contents.
- Android APK and release APK proof metadata no longer list native picker UI UAT as remaining proof.
- Mobile UAT docs and target-status ledger now keep physical-device install UAT and Bluetooth negotiation as the
  remaining Android gaps.

## Evidence

- `node --check scripts/android-picker-ui-smoke.mjs && node --check scripts/build-mobile-package.mjs && node --test test/uat-runbooks.test.js` passed.
- `node --test test/mobile-package.test.js` passed: 5/5.
- `npm run test:android-apk && npm run test:android-release-apk` passed.
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-picker-ui` passed and printed `Proof android-picker-ui: native picker UI selected meshdrop-picker-proof.txt and returned it to farm.sandwich.meshdrop/.MainActivity on emulator-5580`.
- `npm test` passed: 189/189.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors; it reports existing complexity warnings for
  `scripts/build-mobile-package.mjs`.
- `npx --yes aislop scan .` ran and failed on existing full-repo baseline: 460 `no-undef` lint errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, 33 code-quality warnings, 57 AI-slop warnings, and 94 lint warnings.

## Not Proven

- Physical Android device install UAT.
- Bluetooth transport negotiation.
- Native iOS app/package and iOS file-picker/share-sheet integration.
