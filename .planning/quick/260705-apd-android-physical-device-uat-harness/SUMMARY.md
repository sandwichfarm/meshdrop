# Android Physical Device UAT Harness Summary

## Result

Added a physical Android hardware UAT harness that selects an attached physical ADB device, rejects emulator-only and
ambiguous multi-device states, and then runs the existing Android runtime smokes with `MESHDROP_ANDROID_SERIAL`.

## Evidence

- `node --test test/android-physical-device-uat.test.js test/uat-runbooks.test.js` passed 6/6.
- `node --check scripts/android-physical-device-uat.mjs` passed.
- `npm run test:android-physical-device` fails closed with `Not proven: No physical Android device attached...` because no
  physical device is attached in this environment.
- `npm test` passed 211/211 after `npm ci`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still reports the existing baseline: 57 warnings in vendored noble files,
  `public/scripts/network.js`, oversized/duplicate files, and `server/nostr-identity.js`.

## Known Gaps

- Physical Android UAT is not proven until `npm run test:android-physical-device` passes with real hardware attached.
