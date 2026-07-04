---
status: complete
created: 2026-07-04
slug: ghcr-anonymous-readback
---

# Quick Task: GHCR Anonymous Readback

## Goal

Make anonymous GHCR image readback deterministic and record the current blocker for the `v0.1.0` release.

## Scope

- Add `npm run verify:ghcr-anonymous -- v0.x.y`.
- Verify all `standalone`, `start9`, and `umbrel` tag pairs for `linux/amd64` and `linux/arm64`.
- Use a temporary `DOCKER_CONFIG` instead of mutating the user's Docker login state.
- Record current `v0.1.0` anonymous readback failure and package-token limitation.
- Keep target status honest: authenticated release proof exists; anonymous proof remains blocked until package visibility is public or a newer release proves it.

## Out Of Scope

- Changing GHCR package visibility without package-scoped credentials.
- Cutting a new release tag.
- Device UAT for StartOS or Umbrel.

## Validation

- Focused release workflow/doc tests.
- Live anonymous verifier run against `v0.1.0`.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
