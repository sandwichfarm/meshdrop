---
quick_id: 260707-6f1
slug: separate-instance-assisted-webrtc-from-c
status: in_progress
created_at: 2026-07-07T02:37:15.829Z
---

# Separate Instance-Assisted WebRTC From Clearnet Policy

## Goal

Fix the route ontology and any regression where disabling Clearnet/WebRTC policy blocks Instance-assisted sharing. Instance sharing is server/instance-assisted WebRTC signaling/peering. Clearnet is direct Internet WebRTC transport. Nostr remains discovery/signaling and must not be treated as the file transport itself.

## Plan

1. Map current route/service labels, toggles, and tests for Instance, Clearnet, Nostr, FIPS, and Pollen.
2. Add or update regression tests proving:
   - disabling Clearnet does not disable Instance-assisted sharing;
   - disabling WebRTC signaling for future discovery does not tear down already-established peer state where the code can preserve it;
   - UI labels distinguish Instance from Clearnet/direct Internet.
3. Implement the smallest policy/UI fix using existing route helpers.
4. Verify focused tests, broad tests, e2e/runtime proof if browser-visible, and AI-slop gates.
5. Commit, push, open PR, and leave an operator-testable path.

## Initial Git Brief

- Operator worktree: `/home/sandwich/Develop/meshdrop`, branch `master`, dirty path `fips.yaml`.
- Task worktree: `/home/sandwich/Develop/meshdrop-instance-clearnet-route-policy-20260707`, branch `agent/instance-clearnet-route-policy-20260707`, base `origin/master@48fccbc`.
- Dirty-state decision: ignore unrelated operator `fips.yaml`; all edits stay in task worktree.
