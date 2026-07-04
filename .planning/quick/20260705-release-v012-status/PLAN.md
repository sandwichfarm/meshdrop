---
status: complete
created: 2026-07-05
slug: release-v012-status
---

# Quick Task: Release v0.1.2 Status

## Goal

Update release UAT status so the docs point at the current `v0.1.2` proof instead of stale `v0.1.0` evidence.

## Scope

- Guard the release UAT docs against stale release evidence.
- Update `docs/uat/release-target-images.md` with the `v0.1.2` release assets, target image jobs, Docker smoke proof,
  and anonymous GHCR blocker.
- Update `docs/uat/target-status.md` with the same current release-image boundary.

## Out Of Scope

- Changing GHCR package visibility.
- Cutting a new release tag.
- Implementing native desktop/mobile shells or StartOS/Umbrel device UAT.

## Validation

- Red/green `node --test test/uat-runbooks.test.js`.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
