---
status: complete
date: 2026-07-07
quick_id: 260707-clearnet-exclusion-private-routes
slug: clearnet-exclusion-private-routes
---

# Plan: Clearnet Exclusion Still Uses Nostr Route Discovery

## Goal

Make the Clearnet file-route exclusion force transfers away from same-instance and direct Nostr-signaled WebRTC while keeping Nostr discovery/signaling available to request encrypted FIPS/Pollen route descriptors.

## Tasks

1. Lock the policy split with regression tests.
   - Files: `test/rtc-peer-signaling.test.js`, `test/local-discovery-protocol.test.js` if needed.
   - Done: disabled Clearnet ignores direct Nostr as a transfer route but still requests a FIPS/Pollen private route from Nostr capability presence.

2. Implement pending private-route seeding.
   - Files: `public/scripts/network.js`.
   - Done: disallowed Nostr presence with FIPS/Pollen capability creates no direct RTCPeer, emits encrypted route request, and promotes the returned FIPS/Pollen candidate into the active WebRTC signaling route.

3. Verify and ship.
   - Commands: focused tests, `npm test`, e2e/docker if touched behavior needs runtime proof, `git diff --check`, changed/full AI-slop scans.
   - Done: summary records exact evidence and known gaps.
