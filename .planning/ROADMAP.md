# Roadmap: MeshDrop v0.10.0 Overlay Network Adapters

## Phase 14: Overlay Network Adapters

Goal: add Tor, I2P, and Loki as configured backend route adapter types using the shared descriptor/scoring model, while failing closed until real local dial support exists.

Current status: complete.

Requirements: ONA-01, ONA-02, ONA-03, ONA-04, ONA-05.

Success criteria:

1. Focused tests fail first because runtime capabilities do not mention Tor/I2P/Loki.
2. One server-side overlay adapter catalog normalizes Tor, I2P, and Loki config.
3. `/config` and static runtime config expose Tor/I2P/Loki unsupported by default with explicit unavailable reasons.
4. Configured server capabilities expose private stream metadata for Tor/I2P/Loki without touching FIPS/Pollen semantics.
5. Route contract tests prove Tor/I2P/Loki descriptors and scoring reuse the generic route model.

Verification:

- Focused: overlay adapter config, runtime capabilities, SPA runtime config, and route contract tests.
- Runtime honesty: `/config` exposes unsupported Tor/I2P/Loki by default and configured stream metadata only when explicit adapter config exists.
- Browser: `npm run test:e2e` because runtime capability metadata changes.
- Broad local: `npm test`.
- Docker: `npm run test:docker`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

1. Tor/I2P/Loki byte-transfer proof with real local daemon/proxy dial evidence.
2. TURN overlay relay: add relay-only ICE proof only where the browser can actually dial the relay path.

---
*Roadmap updated: 2026-07-07 after completing milestone v0.10.0 Overlay Network Adapters.*
