---
status: complete
quick_id: 260706-ux-network-postures
slug: ux-network-postures
date: 2026-07-06
---

# Quick Task 260706: UX Network Postures

## Goal

Make MeshDrop's shared UI communicate discovery and transfer choices clearly across every target that supports the
feature. Same-instance discovery, FIPS, and Pollen should read as network postures; Blossom and Hashtree should read as
storage/server routes; WebRTC should be described as the peer data-channel method instead of a confusing peer network.

## Scope

1. Add Pollen to the footer "You can be discovered" badges when Pollen mesh discovery is active.
2. Reorder network posture UI to instance, FIPS, Pollen, then relay/room/paired fallbacks where applicable.
3. Group transfer choices into network routes and storage routes with clear capability details and peer counts.
4. Keep the implementation shared in the common web runtime so Docker, SPA, desktop, and mobile targets inherit it when
   their runtime capabilities expose the corresponding features.

## Constraints

- No new dependencies.
- Do not claim payload privacy selector completion until unencrypted confirmation and client-side encrypted payload
  behavior are both implemented and proven.
- Preserve existing route behavior while improving labels, grouping, and affordances.

## Verification Plan

- Focused protocol/UI tests for footer badges and route grouping.
- Full `npm test`.
- Browser/runtime proof if route dialog or footer rendering changes.
- `git diff --check`.
- AI-slop changed-code and full-repo scans.
