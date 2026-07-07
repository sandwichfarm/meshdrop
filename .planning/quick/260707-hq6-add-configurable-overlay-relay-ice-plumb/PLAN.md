---
quick_id: 260707-hq6
slug: add-configurable-overlay-relay-ice-plumb
date: 2026-07-07
status: complete
---

# Quick Task 260707-hq6: Add Configurable Overlay Relay ICE Plumbing

## Goal

Make FIPS/Pollen relay ICE capability configurable from server/runtime config, require a real TURN/TURNS relay server before advertising support, and pass route-specific relay-only RTC config to browser WebRTC setup.

## Constraints

- Do not claim that a relay is FIPS-backed or Pollen-backed without runtime proof.
- Do not silently mark `relayIce.supported` true from a bare boolean.
- Keep default behavior fail-closed: no configured relay means signaling-only.
- Stack on PR #137 so the route policy and relay config ship as one coherent overlay slice.

## Tasks

1. Add regression coverage.
   - Files: `test/runtime-capabilities.test.js`, `test/rtc-peer-signaling.test.js`, new focused server relay config test if useful.
   - Action: prove route relay capability only becomes supported with TURN/TURNS RTC config and that route selection uses route-specific relay-only ICE servers.

2. Add server/runtime config parsing.
   - Files: `server/index.js`, `server/runtime-capabilities.js`, helper if needed.
   - Action: support FIPS/Pollen relay ICE config from env/file-backed RTC config and expose it through `/config` capabilities.

3. Add client route-specific RTC config plumbing.
   - Files: `public/scripts/runtime-capabilities.js`, `public/scripts/network.js`.
   - Action: read `relayIce.rtcConfig` and use it when an overlay relay route is selected.

4. Verify and ship.
   - Run focused tests, `git diff --check`, changed-code slop, and one relevant broader local gate.
   - Update PR #137 instead of opening another PR.
