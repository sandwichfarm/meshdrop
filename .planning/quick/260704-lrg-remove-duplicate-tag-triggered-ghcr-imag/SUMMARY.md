# Summary

## Change

- Deleted `.github/workflows/github-image.yml`.
- Added a release workflow regression that requires release tags to use one workflow for GitHub release artifacts and GHCR images.
- Kept `.github/workflows/release.yml` as the single `v0.*.*` release surface.

## Evidence

- Red proof: `node --test test/release-workflow.test.js` failed before deletion because `github-image.yml` existed (`true !== false`).
- `node --test test/release-workflow.test.js` passed: 3/3.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml .github/workflows/docker-image.yml` passed.
- `git diff --check` passed.
- First `npm test` failed before code execution because the fresh worktree had no `node_modules`.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed: 157/157.
- `npx --yes aislop scan --changes .` exited 0 but reported `0 changed file(s)`, so it did not provide meaningful coverage for this workflow/test deletion slice.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors, 3 direct `innerHTML` security findings in `public/scripts/ui.js`, console/trivial-comment warnings, duplicate-code warnings, and file-size warnings.

## Known Gaps

- No real `v0.*.*` release tag was pushed in this slice.
- GHCR image publication remains unproven until a release tag runs.
