---
status: complete
created: 2026-07-04
slug: release-smoke-before-anon
---

# Quick Task: Release Smoke Before Anonymous Gate

## Goal

Make release readback collect Docker smoke proof before the anonymous GHCR visibility gate can fail.

## Scope

- Move `Run Docker smoke against pulled standalone image` before `Verify anonymous GHCR manifests`.
- Add a regression test that enforces this ordering.
- Keep anonymous GHCR verification strict and failing when images are not public.

## Out Of Scope

- Changing GHCR package visibility.
- Cutting a release tag before this ordering change lands.
- Changing Docker smoke behavior.

## Validation

- Focused release workflow test.
- YAML parse.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
