# Release Ceremony Baseline Summary

## Completed

- Replaced the stale one-image GHCR workflow with a tag-triggered matrix for `standalone`, `start9`, and `umbrel`.
- Replaced the stale PairDrop CLI zip release workflow with a MeshDrop GitHub release workflow.
- Pinned workflow actions to current release SHAs verified on 2026-07-04.
- Kept release automation on `v0.*.*` tag pushes only.

## Verification

- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml .github/workflows/github-image.yml .github/workflows/release.yml` passed.
- Local artifact smoke created `meshdrop-source-0.0.0.tar.gz`, `meshdrop-node-0.0.0.tar.gz`, and `SHA256SUMS` in `/tmp`.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed: 143/143.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` remains baseline-failing with existing repo-wide no-undef globals, `public/scripts/ui.js` innerHTML security findings, and style/slop warnings.

## Known Gaps

- No live `v0.x.y` tag was created in this task, so GitHub release creation and GHCR pushes are workflow-validated but not production-run.
- Start9 and Umbrel package manifests are still not implemented; this slice only publishes target-named images from the existing Dockerfile.
