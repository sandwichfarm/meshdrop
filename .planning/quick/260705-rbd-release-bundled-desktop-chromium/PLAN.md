---
status: complete
created: 2026-07-05
slug: release-bundled-desktop-chromium
---

# Quick Task: Release Bundled Desktop Chromium

## Goal

Keep alpha release ceremony aligned with the newly proven bundled Desktop Chromium artifact.

## Scope

- Require release workflow tests to fail when the bundled Desktop Chromium artifact is omitted.
- Install Playwright Chromium in the tag release workflow before creating release artifacts.
- Build `meshdrop-desktop-chromium-bundled-<version>.tar.gz` during tagged releases.
- Add the bundled artifact to release readback's expected asset list.

## Out Of Scope

- Cutting a new tag.
- Changing GHCR package visibility.
- Claiming that earlier releases already contain the bundled artifact.

## Validation

- Red/green focused release workflow test.
- Release artifact build smoke for the bundled Desktop Chromium package.
- Repo tests.
- Diff and AI-slop gates.
