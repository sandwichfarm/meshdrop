# Desktop Signed Installer Proof Summary

## Result

Desktop Chromium now has a signed Linux installer proof.

## Changed

- Added `scripts/build-desktop-installer.mjs` to wrap the bundled Desktop Chromium tarball in a self-extracting `.run`
  installer.
- Added detached armored GPG signature, exported public key, and SHA256 readback artifacts for the installer.
- Added `scripts/desktop-installer-smoke.mjs` and `npm run test:desktop-installer` to verify SHA256, verify the
  detached signature from a clean GPG home, run the installer, and launch the installed Desktop Chromium shell.
- Added the installer to CI and release artifact/readback expectations.
- Updated Desktop and release UAT docs plus target status.

## Evidence

- `node --check scripts/build-desktop-installer.mjs && node --check scripts/desktop-installer-smoke.mjs`
- `node --test test/desktop-package.test.js test/ci-workflow.test.js test/release-workflow.test.js test/uat-runbooks.test.js`
- `npm run test:desktop-installer`
- `npm run test:desktop-chromium-bundled`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan --staged .`
- `npx --yes aislop scan .` ran and still reports the known full-repo baseline failures outside this slice.

## Remaining

- GTK/WebKit native shell still gates WebRTC off until a native engine exposes `RTCPeerConnection`.
- Full finish-line goal remains open for Start9/Umbrel device UAT, iOS native package/device proof, physical Android UAT,
  and GHCR anonymous visibility.
