# Release Target Image UAT Runbook

Use this runbook for alpha `v0.*.*` release images published by `.github/workflows/release.yml`.

## Targets

The release workflow builds and pushes these GHCR image targets as multi-architecture manifests for `linux/amd64` and `linux/arm64`:

| Target | Expected image metadata |
|--------|--------------------------|
| `standalone` | `MESHDROP_TARGET=standalone`, `farm.sandwich.meshdrop.target=standalone`, tag suffix `:standalone` |
| `start9` | `MESHDROP_TARGET=start9`, `farm.sandwich.meshdrop.target=start9`, tag suffix `:start9` |
| `umbrel` | `MESHDROP_TARGET=umbrel`, `farm.sandwich.meshdrop.target=umbrel`, tag suffix `:umbrel` |

## Local Preflight

For each target, run a local build before pushing a release tag:

```sh
target=standalone
docker build \
  --build-arg MESHDROP_TARGET="${target}" \
  --build-arg MESH_DROP_COMMIT="$(git rev-parse --short HEAD)" \
  -t "meshdrop:target-${target}-smoke" \
  .

docker image inspect "meshdrop:target-${target}-smoke" \
  --format '{{ index .Config.Labels "farm.sandwich.meshdrop.target" }} {{ range .Config.Env }}{{ println . }}{{ end }}'
```

Repeat with `target=start9` and `target=umbrel`.

## Release Acceptance

1. Push an alpha tag that matches `v0.*.*`.
2. Wait for the `Release` workflow to finish.
3. Confirm the GitHub release contains source, Node runtime, SPA tarball, Start9 source tarball, Umbrel package tarball,
   and `SHA256SUMS` artifacts.
4. Confirm GHCR has both tag-preserving and version-only tags for each target:
   - `v0.x.y-standalone` and `0.x.y-standalone`.
   - `v0.x.y-start9` and `0.x.y-start9`.
   - `v0.x.y-umbrel` and `0.x.y-umbrel`.
5. Confirm each tag is a multi-architecture manifest with `linux/amd64` and `linux/arm64` entries:

   ```sh
   docker buildx imagetools inspect ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone
   docker buildx imagetools inspect ghcr.io/sandwichfarm/meshdrop:v0.x.y-start9
   docker buildx imagetools inspect ghcr.io/sandwichfarm/meshdrop:v0.x.y-umbrel
   ```

6. Pull each image and confirm its target metadata:

   ```sh
   docker pull ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone
   docker image inspect ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone \
     --format '{{ index .Config.Labels "farm.sandwich.meshdrop.target" }}'
   ```

7. Run `npm run test:docker` against the pulled standalone image:

   ```sh
   MESHDROP_DOCKER_IMAGE=ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone npm run test:docker
   ```

8. Dispatch the repo-owned release verification workflow so GHCR readback runs with GitHub Actions package permissions:

   ```sh
   gh workflow run release-verify.yml --repo sandwichfarm/meshdrop --ref master -f tag=v0.x.y
   gh run watch <run-id> --repo sandwichfarm/meshdrop --exit-status
   ```

## Not proven

- `v0.1.0` is proven by release run `28711136765` and release verification run `28711452622`.
- A future release is not proven until its real `v0.*.*` tag runs and the GitHub release plus GHCR tags are read back.
- The release workflow is configured for multi-architecture GHCR manifests, but no multi-arch release is proven until
  `docker buildx imagetools inspect` confirms the published tags. If the local token lacks `read:packages`, use
  `release-verify.yml` for that readback.
- The Start9 package-source artifact is not complete until `.s9pk` build, device install, and transfer UAT pass.
- The Umbrel package artifact is not complete until device install and transfer UAT pass on Umbrel.

## Current Verified Release

`v0.1.0` was published on 2026-07-04 and verified with these readbacks:

- GitHub release: https://github.com/sandwichfarm/meshdrop/releases/tag/v0.1.0
- Release workflow: https://github.com/sandwichfarm/meshdrop/actions/runs/28711136765
- Release verification workflow: https://github.com/sandwichfarm/meshdrop/actions/runs/28711452622
- Assets: `meshdrop-node-0.1.0.tar.gz`, `meshdrop-source-0.1.0.tar.gz`, `meshdrop-spa-0.1.0.tar.gz`,
  `meshdrop-start9-0.1.0.tar.gz`, `meshdrop-umbrel-0.1.0.tar.gz`, and `SHA256SUMS`.
- GHCR tags checked by `release-verify.yml`: `v0.1.0-standalone`, `0.1.0-standalone`, `v0.1.0-start9`,
  `0.1.0-start9`, `v0.1.0-umbrel`, and `0.1.0-umbrel`.
- `release-verify.yml` confirmed `linux/amd64` and `linux/arm64` manifests, pulled target metadata, and
  `npm run test:docker` against `ghcr.io/sandwichfarm/meshdrop:v0.1.0-standalone`.
