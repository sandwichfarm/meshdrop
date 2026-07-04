# Release Multi-Arch Images Summary

## Changed

- Release target images now publish through Docker Buildx instead of single-architecture `docker build` plus `docker push`.
- GHCR release image tags are configured as `linux/amd64` and `linux/arm64` manifests for `standalone`, `start9`,
  and `umbrel`.
- New Docker GitHub Actions are pinned by SHA:
  - `docker/setup-qemu-action` `v4.2.0`
  - `docker/setup-buildx-action` `v4.2.0`
  - `docker/build-push-action` `v7.3.0`
- Release UAT docs now require `docker buildx imagetools inspect` manifest readback before claiming a multi-arch release.
- Target status now tracks release images as configured automation, not proven live release output.

## Verification

- Red proof: `node --test test/release-workflow.test.js` failed before the workflow edit because QEMU/Buildx/build-push
  steps were absent.
- `node --test test/release-workflow.test.js test/uat-runbooks.test.js` passed: 4/4.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml")'` passed.
- `npm test` passed: 163/163.
- `git diff --check` and `git diff --cached --check` passed.

## Gaps

- `actionlint` is not installed locally, and `npx --yes actionlint .github/workflows/release.yml` failed because the npm
  package did not expose an executable.
- `npx --yes aislop scan --changes .` and `--base origin/master` reported zero changed files despite `git diff` listing
  this slice's changed files. A repo-wide `aislop` scan still fails on the existing baseline.
- No real `v0.*.*` release tag was cut, so GitHub release artifacts, GHCR tags, multi-arch manifests, and pulled-image smoke
  remain unproven live release surfaces.
