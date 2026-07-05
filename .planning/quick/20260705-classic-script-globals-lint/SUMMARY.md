---
status: complete
completed: 2026-07-05
task: Declare classic-script globals for full-repo lint
---

# Summary

Removed full-repo `aislop` `no-undef` errors caused by intentional classic browser script globals.

## Changes

- Switched classic global consumers in `main.js`, `nostr-identity.js`, `nostr-relays.js`, and the service worker to explicit `globalThis` references.
- Exported `ServerConnection` and `PeersManager` from `network.js` so deferred browser hydration still works when `main.js` uses `globalThis`.
- Removed async Promise executors in `main.js` and `service-worker.js`.
- Removed trivial service-worker cache comments and leftover cache debug logs flagged during changed-code slop scanning.

## Verification

- `node --check public/scripts/main.js && node --check public/scripts/nostr-identity.js && node --check public/scripts/nostr-relays.js && node --check public/scripts/network.js && node --check public/service-worker.js`
- `node --test test/service-worker-cache-version.test.js test/static-config.test.js test/action-visibility.test.js` -> 19 passed
- `npm test` -> 200 passed
- `npm run test:e2e` -> passed local WebRTC, Blossom, Hashtree, FIPS WebRTC, Pollen WebRTC, Pollen storage, Nostr WebRTC, and federated FIPS WebRTC transfer proofs
- `git diff --check`
- `npx --yes aislop scan --changes .` -> exit 0, 0 errors, 0 AI-slop issues, 7 warnings in touched large legacy files
- `npx --yes aislop scan .` -> exit 1, 0 errors, 109 baseline warnings

## Known Gaps

- Full-repo `aislop` still fails on baseline warnings: console logs, vendored noble-ciphers unused expressions, large files, duplicate blocks, trivial comments, TODOs, hardcoded URLs, and minor lint warnings.
- This slice reduces baseline errors to zero; it does not clean the remaining warnings.
