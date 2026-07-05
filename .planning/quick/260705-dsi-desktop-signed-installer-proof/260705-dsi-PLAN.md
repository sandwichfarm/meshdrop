# Desktop Signed Installer Proof

## Goal

Close the Desktop target's signed-installer gap without claiming GTK/WebKit native WebRTC support.

## Scope

- Add a Linux self-extracting Desktop Chromium installer artifact.
- Sign the installer with a detached armored GPG signature.
- Export the verification public key and SHA256 readback file.
- Add automated smoke proof that verifies the signature, runs the installer, and launches the installed desktop shell.
- Include installer assets in release generation and release readback.
- Update UAT docs and target ledger.

## Verification

- `node --test test/desktop-package.test.js test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js`
- `npm run test:desktop-installer`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
