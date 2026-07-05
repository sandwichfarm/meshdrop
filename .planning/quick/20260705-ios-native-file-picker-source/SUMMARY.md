# iOS Native File Picker Source Summary

## Result

The generated iOS native-source wrapper now wires WKWebView file inputs to the native document picker through the
iOS 18.4+ `WKUIDelegate` open-panel hook and `UIDocumentPickerViewController`.

## Changed Files

- `scripts/mobile-native-source.mjs`
- `test/mobile-package.test.js`
- `test/uat-runbooks.test.js`
- `docs/uat/mobile.md`
- `docs/uat/target-status.md`

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js` passed: 6/6 tests.
- `npm run build:ios:native-source -- --version 0.0.0-proof --out-dir <tmp>` generated a wrapper containing
  `WKUIDelegate`, `@available(iOS 18.4, *)`, `UIDocumentPickerViewController`, and document picker delegate callbacks.
- `node --check scripts/mobile-native-source.mjs` passed.
- `npm test` passed: 200/200 tests.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with 0 errors and 1 pre-existing warning: `androidActivitySource`
  function too long in the touched generator file.
- `npx --yes aislop scan .` exited 1 with 0 errors and 58 baseline warnings.

## Known Gaps

- No iOS app build, simulator, physical device, picker UAT, share-sheet UAT, or native mobile WebRTC transfer UAT was run.
- GHCR anonymous readback remains blocked: `npm run verify:ghcr-anonymous -- v0.1.4` still returns `unauthorized`.
