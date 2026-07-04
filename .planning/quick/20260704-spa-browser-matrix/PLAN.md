# SPA Browser Matrix

## Goal

Prove the backend-free SPA smoke across Chromium, Firefox, and WebKit without overstating unsupported paths.

## Scope

- Make `scripts/spa-artifact-smoke.mjs` launch the browser selected by `PLAYWRIGHT_BROWSER`.
- Add a CI matrix job that installs and runs `npm run test:spa-artifact` for Chromium, Firefox, and WebKit.
- Prove backend-free SPA WebRTC transfer on browsers that can complete the two-page proof in CI.
- Keep WebKit as packaged-runtime proof only if Playwright WebKit cannot complete the two-page WebRTC transfer proof.
- Update SPA UAT and the target status ledger without claiming public-relay UAT.

## Out Of Scope

- Public relay/two-host UAT.
- Docker browser matrix.
- Native desktop, iOS, Android, Start9 device UAT, or Umbrel device UAT.

## Validation

- Red: `node --test test/spa-artifact.test.js` fails before implementation because browser-matrix support is absent.
- Green: focused tests for SPA artifact, UAT docs, and CI guards.
- Local Chromium SPA transfer proof.
- CI matrix proof for Chromium, Firefox, and WebKit after PR creation.
- PR/master CI evidence must distinguish Chromium/Firefox transfer proof from WebKit runtime proof.
