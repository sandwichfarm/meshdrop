---
status: in_progress
created: 2026-07-04
slug: target-artifact-ci
---

# Quick Task: Target Artifact CI

## Goal

Run the Desktop/iOS/Android source artifact transfer smoke in pull-request CI.

## Scope

- Add a CI job that installs Chromium and runs `npm run test:target-artifacts`.
- Guard the workflow wiring with a unit test.
- Keep manual public-relay and WebKit UAT jobs unchanged.

## Out Of Scope

- Native desktop/mobile shell builds.
- Device UAT.
- Release tag creation.
- GHCR package visibility changes.

## Validation

- Red/green workflow guard.
- `npm run test:target-artifacts`.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml`.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
