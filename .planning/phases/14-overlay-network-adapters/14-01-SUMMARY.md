# Phase 14 Summary: Overlay Network Adapters

## Result

Complete. MeshDrop now treats Tor, I2P, and Loki as first-class overlay route adapter types in runtime capability metadata and the generic route descriptor/scoring contract, while failing closed by default and not claiming byte-transfer support.

## Changed

- Added a shared server-side overlay adapter catalog for Tor, I2P, and Loki.
- Added `/config` runtime capability entries for default unsupported overlay adapters and explicitly configured stream adapters.
- Added backend-free SPA/static runtime overlay entries that ignore backend-only Tor/I2P/Loki claims.
- Added tests for overlay adapter config, endpoint validation, descriptor building, `/config` exposure, static runtime honesty, and generic descriptor/scoring behavior.
- Left Nostr route capability publication unchanged so Tor/I2P/Loki are not advertised as live route options before descriptor response and byte-transfer primitives exist.

## Verification

- `node --test test/overlay-network-adapters.test.js test/runtime-capabilities.test.js test/spa-runtime-config.test.js test/route-contract.test.js test/server-admin-settings.test.js` -> passed, 33/33.
- `npm test` -> passed, 354/354.
- `npm run test:e2e` -> passed; local, Blossom, Hashtree, Pollen storage, Nostr WebRTC, federated Pollen signaling, and Pollen instance relay proofs passed.
- `npm run test:docker` -> passed; Docker local WebRTC, admin settings, and two-host Nostr WebRTC proofs passed for `meshdrop:smoke`.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.
- `npx --yes aislop scan .` -> baseline failing outside changed files: noble unused expressions, large files, duplicate blocks, long functions, `server/nostr-identity.js` hardcoded URL, noble TODOs, and one empty noble utility function.

## Remaining Risk

- Tor/I2P/Loki byte-transfer is not complete. This phase only adds fail-closed adapter capability and descriptor surfaces. Real route completion still requires a local daemon/proxy dial surface plus transfer proof naming bytes sent/received, primitive, hash match, and fallback status.
