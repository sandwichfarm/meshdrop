---
status: complete
completed: 2026-07-05
slug: release-bundled-desktop-chromium
---

# Summary

The next tagged alpha release will build and read back the bundled Desktop Chromium artifact.

## Changed

- Added a release workflow Chromium install step for the bundled builder.
- Added `npm run build:desktop:chromium-bundled` to release artifact creation.
- Added `meshdrop-desktop-chromium-bundled-<version>.tar.gz` to release verification's expected asset list.
- Added release workflow regression assertions for the bundled artifact.

## Evidence

- Red proof: `node --test test/release-workflow.test.js` failed because release build/readback omitted the bundled artifact.
- Green proof: `node --test test/release-workflow.test.js` passed 5/5 after the workflow update.
- Dependency install proof: `npm ci` passed with 0 vulnerabilities in this fresh worktree.
- Artifact proof: `npm run build:desktop:chromium-bundled -- --version 0.0.0-release-bundled-smoke --out-dir <tmp>`
  produced `meshdrop-desktop-chromium-bundled-0.0.0-release-bundled-smoke.tar.gz` containing
  `bin/chromium/chrome` and `meshdrop-target.json`.
- Repo proof: `npm test` passed 194/194.
- Workflow syntax proof: `ruby -e 'require "yaml"; ...'` parsed release workflows, and
  `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml .github/workflows/release-verify.yml`
  passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean; it reported 0 changed code files because this slice changes workflows,
  tests, and planning metadata.
- `npx --yes aislop scan .` still fails on the known repo baseline: 417 `no-undef` lint errors, 3 direct `innerHTML`
  security errors, 42 console warnings, duplicate/size/long-function warnings, and vendor TODO/stub warnings.

## Remaining Risk

- No new tag was cut in this slice, so current published `v0.1.4` release contents are unchanged.
- Anonymous GHCR readback remains blocked by package visibility.
