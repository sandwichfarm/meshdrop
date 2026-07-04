# Release Target Image UAT Runbook

Use this runbook for alpha `v0.*.*` release images published by `.github/workflows/release.yml`.

## Targets

The release workflow builds and pushes these GHCR image targets:

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
5. Pull each image and confirm its target metadata:

   ```sh
   docker pull ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone
   docker image inspect ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone \
     --format '{{ index .Config.Labels "farm.sandwich.meshdrop.target" }}'
   ```

6. Run `npm run test:docker` against the pulled standalone image:

   ```sh
   MESHDROP_DOCKER_IMAGE=ghcr.io/sandwichfarm/meshdrop:v0.x.y-standalone npm run test:docker
   ```

## Not proven

- No release is proven until a real `v0.*.*` tag runs and the GitHub release plus GHCR tags are read back.
- The Start9 package-source artifact is not complete until `.s9pk` build, device install, and transfer UAT pass.
- The Umbrel package artifact is not complete until device install and transfer UAT pass on Umbrel.
- Multi-architecture publication is not implemented.
