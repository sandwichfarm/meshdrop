# Clearnet Route Visibility Smoke Expectations Summary

Status: complete

## Result

SPA and target artifact runtime smokes now expect the Clearnet route control to remain visible in backend-free runtimes because direct Nostr WebRTC is still a Clearnet file-byte route that users must be able to exclude. The stale e2e retry label now matches the honest federated Pollen discovery/signaling proof name.

## Evidence

- `npm run test:spa-artifact` - Chromium SPA artifact Nostr WebRTC transfer passed with visible Clearnet route control.
- `npm run test:target-artifacts` - Desktop, iOS, and Android target artifact Nostr WebRTC transfer smokes passed with visible Clearnet route control.
- `npm run test:e2e` - browser transfer smoke passed and logs `federated-pollen-signaled-webrtc`.
- `npm run test:docker` - Docker smoke passed locally, including local WebRTC and two-host Nostr WebRTC transfer.
- `npm test` - 287/287 pass.
- `git diff --check` - clean.
- `npx --yes aislop scan --changes .` - exits 0; AI-slop, security, and linting clean; only existing size/long-function warnings in smoke scripts.
- `npx --yes aislop scan .` - exits 1 on existing full-repo baseline warnings outside this fix: noble-ciphers unused expressions/TODOs/empty function body, large files, duplicate blocks, and `server/nostr-identity.js` hardcoded URL.

## Remaining Gap

No FIPS/Pollen relay-only WebRTC byte transport is implemented here; that remains tracked in `docs/webrtc-overlay-transport-requirements.md`.
