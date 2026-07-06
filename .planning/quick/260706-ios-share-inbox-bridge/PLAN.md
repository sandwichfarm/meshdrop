# iOS Share Inbox Bridge

## Goal

Expose files staged by the generated iOS share extension to the containing WKWebView app without claiming device UAT.

## Scope

- Add generated Swift source that injects staged share metadata into WKWebView.
- Add a WKScriptMessageHandler bridge for reading staged files from the App Group inbox as base64.
- Lock source artifact shape with package tests.
- Update UAT runbook and target ledger to keep signed-device/share-sheet transfer proof open.

## Verification

- `node --test test/mobile-package.test.js test/uat-runbooks.test.js`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Not In Scope

- Claiming iOS device picker UAT.
- Claiming signed App Group provisioning.
- Claiming iOS share-sheet transfer or native mobile WebRTC UAT.
