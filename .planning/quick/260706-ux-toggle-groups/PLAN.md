---
status: complete
quick_id: 260706-ux-toggle-groups
slug: ux-toggle-groups
date: 2026-07-06
---

# Quick Task 260706: UX Toggle Groups

## Goal

Fix the shared header toggle layout so every target that serves the common web UI shows discovery/network postures
separately from storage routes.

## Scope

1. Keep the implementation in shared `public/index.html` and `public/styles/styles-main.css`, not Docker-specific code.
2. Show visible group labels for Network and Storage controls.
3. Keep network order as Instance, FIPS, Pollen, Relay.
4. Keep Blossom and Hashtree under Storage.
5. Preserve existing button IDs and controller behavior.

## Verification Plan

- Focused header markup test for grouping and order.
- Focused action visibility tests for existing controller behavior.
- `npm test`.
- `git diff --check`.
- AI-slop changed-code and full-repo scans.
