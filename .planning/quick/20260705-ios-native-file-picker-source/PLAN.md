# iOS Native File Picker Source

## Goal

Move iOS mobile support forward by wiring generated WKWebView file inputs to a native document picker in the iOS native-source artifact.

## Scope

- Update generated iOS native-source `MeshDropViewController.swift` to use the iOS 18.4+ `WKUIDelegate` open-panel hook and `UIDocumentPickerViewController` for file inputs.
- Add source-shape tests that assert the iOS wrapper exposes native picker wiring.
- Update UAT docs and target ledger without claiming iOS device UAT or share-sheet support.

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
