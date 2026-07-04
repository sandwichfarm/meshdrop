---
status: complete
created: 2026-07-04
slug: release-auto-verify
---

# Quick Task: Release Auto Verify

## Goal

Make tagged alpha releases automatically run the release readback verifier after all target images publish.

## Scope

- Add `workflow_call` support to `release-verify.yml` while preserving manual `workflow_dispatch`.
- Add a release workflow job that depends on `container-images` and calls `release-verify.yml` with the pushed tag.
- Keep release verification logic in one workflow.

## Out Of Scope

- Changing GHCR package visibility.
- Cutting or re-running a release tag.
- Changing PR CI paths.

## Validation

- Focused release workflow test.
- YAML parse.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
