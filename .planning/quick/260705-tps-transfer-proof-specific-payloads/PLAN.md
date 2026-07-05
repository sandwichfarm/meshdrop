---
status: in_progress
created: 2026-07-05
---

# Transfer Proof Specific Payloads

## Goal

Make Docker browser transfer smokes prove the specific scenario they claim by sending and asserting per-scenario proof files instead of one reusable proof icon payload.

## Scope

- Update Docker local/Pollen browser transfer smoke payloads.
- Update Docker two-host/public-relay browser transfer smoke payloads.
- Add/adjust focused script guard tests.
- Run focused tests, repo gates, and AI-slop scans before shipping.

## Out of Scope

- Physical device UAT.
- GHCR package visibility changes.
- WebRTC protocol rewrite.
