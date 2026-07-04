# Runtime Capability Contract Summary

## Completed

- Added `/config.capabilities` with runtime, transport, and signed server-settings capability metadata.
- Added a browser `RuntimeCapabilities` helper and loaded it before the main app script.
- Made FIPS discovery, Pollen transfer, and signed FIPS settings controls prefer negotiated capability values with legacy fallback.
- Extended Docker smoke to prove the container exposes capabilities and serves the runtime helper asset.

## Verification

- Focused tests failed before implementation on missing capability module and ignored capability overrides.
- Focused tests passed after implementation: 29/29.
- `npm test` passed: 145/145.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed and proved local WebRTC, FIPS WebRTC, Pollen WebRTC, Pollen storage, Nostr WebRTC, Blossom, Hashtree, and federated FIPS WebRTC transfers.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke` and proved `/config.capabilities`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with 0 errors and 7 pre-existing `server/server.js` console warnings.
- `npx --yes aislop scan .` remains baseline-failing with existing browser-global no-undef errors, `public/scripts/ui.js` innerHTML findings, and style/slop warnings.

## Known Gaps

- This is the contract for the current server-backed runtime; SPA/static, desktop, mobile, Start9, and Umbrel runtime implementations still need their own capability manifests/build paths.
