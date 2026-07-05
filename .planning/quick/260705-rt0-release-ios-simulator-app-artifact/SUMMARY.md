---
status: complete
quick_id: 260705-rt0
slug: release-ios-simulator-app-artifact
date: 2026-07-05
---

# Summary

Alpha releases now build `meshdrop-ios-simulator-app-<version>.tar.gz` on macOS, download that artifact into the
release job before checksums are generated, publish it with the GitHub release, and require it during release readback.

# Evidence

- `node --test test/release-workflow.test.js test/uat-runbooks.test.js` passed 6/6.
- YAML parse passed for `.github/workflows/release.yml` and `.github/workflows/release-verify.yml`.
- `npm ci` passed.
- `npm test` passed 204/204.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` was clean but reported `0 changed file(s)` before staging.
- `npx --yes aislop scan .` ran and reported the known full-repo baseline: 57 warnings outside this slice.

# Known Gaps

- `npx --yes actionlint .github/workflows/release.yml .github/workflows/release-verify.yml` could not run locally:
  npm reported `could not determine executable to run`.
- This does not prove signed/device-installable iOS packages or iOS device transfer UAT.
- The existing GHCR anonymous readback blocker remains until package visibility is fixed.
