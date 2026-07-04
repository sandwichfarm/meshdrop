# Prove backend-free SPA transfer

## Problem

The SPA artifact smoke proves the no-backend runtime capability contract, but target status still says backend-free file
transfer UAT is missing. The finish-line goal requires transfer proof before claiming any WebRTC path works.

## Scope

- Extend `npm run test:spa-artifact` to build and serve the real SPA tarball, open two browser contexts, connect
  Nostr identities, discover peers through a static-host-compatible relay path, and initiate a real file transfer.
- Keep the proof backend-free: no `/config`, no WebSocket app server, no FIPS/Pollen/local-discovery backend endpoints.
- Update SPA UAT docs and target status if the transfer proof passes.
- Add a static regression to keep the smoke wired to the backend-free transfer proof.

## Out Of Scope

- Public relay UAT.
- Browser matrix across Firefox/Safari.
- Mobile/native runtime work.

## Verification Plan

- Red/green focused test around `test:spa-artifact` wiring.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
