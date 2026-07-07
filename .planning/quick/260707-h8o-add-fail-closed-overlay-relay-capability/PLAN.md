---
quick_id: 260707-h8o
slug: add-fail-closed-overlay-relay-capability
date: 2026-07-07
status: complete
---

# Quick Task 260707-h8o: Add Fail-Closed Overlay Relay Capability

## Goal

Make forced FIPS/Pollen WebRTC route selection fail closed when the runtime has no overlay relay ICE capability, instead of treating private FIPS/Pollen signaling descriptors as byte-transport proof.

## Constraints

- Do not fake a FIPS/Pollen TURN relay.
- Keep Nostr discovery/signaling usable when Clearnet file routes are disabled.
- Use current capability config and route-status surfaces.
- Preserve the larger requirement in `docs/webrtc-overlay-transport-requirements.md`: real overlay relay candidates remain open until browser/runtime proof exists.

## Tasks

1. Add regression coverage.
   - Files: `test/runtime-capabilities.test.js`, `test/rtc-peer-signaling.test.js`
   - Action: prove `/config` exposes overlay relay ICE availability as false by default, and forced FIPS/Pollen candidates are rejected without starting RTC.
   - Verify: focused tests fail before implementation and pass after.

2. Add overlay relay capability policy.
   - Files: `server/runtime-capabilities.js`, `public/scripts/runtime-capabilities.js`, `public/scripts/network.js`
   - Action: represent FIPS/Pollen relay ICE availability and require it before selecting forced overlay WebRTC routes.
   - Verify: unit tests show fail-closed behavior and route-status reason names the missing relay capability.

3. Record status and run gates.
   - Files: `.planning/STATE.md`, quick task `SUMMARY.md`
   - Action: document this as a fail-closed policy slice, not completion of real FIPS/Pollen overlay relay transport.
   - Verify: focused tests, `npm test`, `git diff --check`, changed-code slop, full-repo slop.
