---
status: complete
quick_id: 260704-rat
slug: release-all-target-artifacts
date: 2026-07-04
---

# Quick Task 260704-rat: Release All Target Artifacts

## Goal

Make alpha release ceremony upload every currently buildable target artifact: SPA, Desktop Native source, iOS source,
Android source, Start9 source, Umbrel package, Node runtime, source archive, and checksums.

## Scope

1. Add desktop, iOS, and Android source artifact builds to `.github/workflows/release.yml`.
2. Add desktop, iOS, and Android asset readback to `.github/workflows/release-verify.yml`.
3. Update release UAT docs to list every expected current artifact without claiming native shell/device UAT.
4. Update tests that guard release workflow and UAT documentation.
5. Update `.planning/STATE.md`.

## Out Of Scope

- Cutting a new release tag.
- Changing existing GHCR package visibility.
- Adding native desktop or mobile dependencies.
- Claiming device/native UAT for desktop, iOS, Android, Start9, or Umbrel.

## Verification

- `node --test test/release-workflow.test.js test/uat-runbooks.test.js` passed: 5/5.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml"); YAML.load_file(".github/workflows/release-verify.yml")'`
  passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml .github/workflows/release-verify.yml`
  passed.
- `npm run build:desktop -- --version 0.0.0-release-smoke --out-dir /tmp/meshdrop-release-artifacts-smoke`
  produced `meshdrop-desktop-0.0.0-release-smoke.tar.gz`.
- `npm run build:ios -- --version 0.0.0-release-smoke --out-dir /tmp/meshdrop-release-artifacts-smoke`
  produced `meshdrop-ios-0.0.0-release-smoke.tar.gz`.
- `npm run build:android -- --version 0.0.0-release-smoke --out-dir /tmp/meshdrop-release-artifacts-smoke`
  produced `meshdrop-android-0.0.0-release-smoke.tar.gz`.
- `npm test` passed: 173/173.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean, reporting zero changed JavaScript files for this
  workflow/docs/test guard slice.
- `npx --yes aislop scan .` still exits nonzero on the existing repo-wide baseline: undefined browser globals,
  existing `innerHTML` security findings in `public/scripts/ui.js`, and style/complexity warnings.
