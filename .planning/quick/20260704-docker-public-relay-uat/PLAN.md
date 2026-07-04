---
status: in_progress
date: 2026-07-04
slug: docker-public-relay-uat
---

# Docker public relay UAT

## Objective

Make Docker two-host public relay UAT produce reliable evidence against public Nostr relay infrastructure, then record
the run without overstating real deployed-admin coverage.

## Plan

1. Reproduce or inspect the failed manual CI public relay run.
2. Harden only the Docker two-host UAT harness if the failure is public relay timing or weak readiness.
3. Verify deterministic two-host Docker smoke still passes.
4. Verify public relay two-host Docker proof locally and through manual GitHub Actions dispatch.
5. Update Docker UAT tracking with exact run evidence and remaining gaps.
