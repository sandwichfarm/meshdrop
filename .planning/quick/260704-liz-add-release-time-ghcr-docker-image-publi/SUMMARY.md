# Summary

## Change

- Added a release `container-images` job that runs after GitHub release artifact creation.
- The job publishes exact-version GHCR tags for `standalone`, `start9`, and `umbrel` targets:
  - `ghcr.io/<owner>/<repo>:v0.x.y-<target>`
  - `ghcr.io/<owner>/<repo>:0.x.y-<target>`
- Added Dockerfile `MESHDROP_TARGET` env and labels so target images carry target metadata.
- Added `test/release-workflow.test.js` to lock the release image contract.

## Evidence

- `node --test test/release-workflow.test.js` passed: 2/2.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release.yml` passed.
- `git diff --check` passed.
- `docker build --build-arg MESHDROP_TARGET=start9 --build-arg MESH_DROP_COMMIT=$(git rev-parse --short HEAD) -t meshdrop:target-start9-smoke .` passed.
- `docker image inspect meshdrop:target-start9-smoke --format ...` returned `start9 MESHDROP_TARGET=start9`.
- First `npm test` and `npm run test:spa-artifact` attempts failed before code execution because the fresh worktree had no `node_modules`.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed: 156/156.
- `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact` passed.
- `npm run test:docker` passed on rebuilt `meshdrop:smoke`.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors, 3 direct `innerHTML` security findings in `public/scripts/ui.js`, console/trivial-comment warnings, duplicate-code warnings, and file-size warnings.

## Known Gaps

- No real `v0.*.*` release tag was pushed in this slice, so GHCR publication is workflow-validated and locally build-proven, not registry-proven.
- Start9 and Umbrel images currently share the base runtime image with target metadata; real package manifests remain future work.
- Multi-architecture image publication is not implemented yet.
