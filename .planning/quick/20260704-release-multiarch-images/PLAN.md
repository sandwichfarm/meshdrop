# Release Multi-Arch Images

## Goal

Make alpha release image publication produce `linux/amd64` and `linux/arm64` GHCR manifests for every release target:
`standalone`, `start9`, and `umbrel`.

## Scope

- Replace single-architecture `docker build` plus separate `docker push` release steps with Buildx multi-platform push.
- Keep the existing target matrix and tag shape.
- Pin newly introduced Docker actions to immutable SHAs with version comments.
- Update UAT docs and status to say multi-arch automation is configured, but live release proof still requires a real tag.

## Out Of Scope

- Cutting a `v0.*.*` release tag.
- Claiming GHCR tags exist before the release workflow runs.
- Proving Start9 `.s9pk`, Umbrel device install, desktop, iOS, or Android UAT.

## Validation

- Red: `node --test test/release-workflow.test.js` fails before workflow edit.
- Green: `node --test test/release-workflow.test.js test/uat-runbooks.test.js`.
- Workflow syntax parse with Ruby YAML loader.
- `npm test`.
- `git diff --check` and changed-file slop scan.
