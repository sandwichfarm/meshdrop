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
3. Confirm the GitHub release contains source, Node runtime, SPA tarball, Desktop Native source tarball, Desktop Native
   Linux shell tarball, Desktop Chromium shell tarball, Desktop Chromium bundled shell tarball, signed Desktop Chromium
   installer `.run`, installer `.asc`, installer `.sha256`, installer `.pubkey.asc`, iOS source tarball,
   iOS native-source tarball, iOS Simulator app tarball, iOS unsigned device app tarball, Android source tarball,
   Android native-source tarball, Android debug APK tarball, Android release APK tarball, Start9 source tarball, Umbrel package tarball, and
   `SHA256SUMS` artifacts.
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

8. Dispatch the repo-owned release verification workflow so authenticated readback runs with GitHub Actions package
   permissions and anonymous GHCR manifest readback is checked after `docker logout ghcr.io`:

   ```sh
   gh workflow run release-verify.yml --repo sandwichfarm/meshdrop --ref master -f tag=v0.x.y
   gh run watch <run-id> --repo sandwichfarm/meshdrop --exit-status
   ```

9. Run a local anonymous GHCR readback without mutating the active Docker login state:

   ```sh
   npm run verify:ghcr-anonymous -- v0.x.y
   ```

   This command uses a temporary `DOCKER_CONFIG` and checks every `standalone`, `start9`, and `umbrel` tag pair for
   `linux/amd64` plus `linux/arm64`.

## Not proven

- Anonymous local readback is not proven for `v0.1.5`: the release readback job failed at anonymous GHCR after Docker
  smoke passed, and the release workflow's `npm run verify:ghcr-anonymous -- v0.1.5` step failed with GHCR
  `unauthorized` for `ghcr.io/sandwichfarm/meshdrop:v0.1.5-standalone`.
- The local GitHub token lacks `read:packages`, so this session cannot inspect package visibility through the Packages
  REST API. Making `ghcr.io/sandwichfarm/meshdrop` public is still required before anonymous manifest readback can pass.
- The iOS source, native-source, unsigned Simulator app, and unsigned device app artifacts are not complete native
  targets until signed device-installable packages and transfer UAT pass.
- Android APK artifacts are not complete until physical-device install UAT passes. The release APK artifact uses
  generated UAT signing and is not Play Store upload signing or AAB proof.
- The Desktop GTK/WebKit shell artifact still gates off native WebRTC until a native transfer UAT passes. The signed
  installer proof covers the Desktop Chromium shell path.
- The Start9 package is not complete until device install and transfer UAT pass on StartOS.
- The Umbrel package artifact is not complete until device install and transfer UAT pass on Umbrel.

## Current Verified Release

`v0.1.5` release assets and authenticated GHCR readback are proven by release run `28760231569`. It was published on
2026-07-06 and verified with these readbacks before the strict anonymous GHCR gate failed:

- GitHub release: https://github.com/sandwichfarm/meshdrop/releases/tag/v0.1.5
- Release workflow: https://github.com/sandwichfarm/meshdrop/actions/runs/28760231569
- Assets: `meshdrop-android-0.1.5.tar.gz`, `meshdrop-android-apk-0.1.5.tar.gz`,
  `meshdrop-android-native-source-0.1.5.tar.gz`, `meshdrop-android-release-apk-0.1.5.tar.gz`,
  `meshdrop-desktop-0.1.5.tar.gz`, `meshdrop-desktop-chromium-0.1.5.tar.gz`,
  `meshdrop-desktop-chromium-bundled-0.1.5.tar.gz`,
  `meshdrop-desktop-chromium-bundled-installer-0.1.5.run`,
  `meshdrop-desktop-chromium-bundled-installer-0.1.5.run.asc`,
  `meshdrop-desktop-chromium-bundled-installer-0.1.5.run.pubkey.asc`,
  `meshdrop-desktop-chromium-bundled-installer-0.1.5.run.sha256`,
  `meshdrop-desktop-linux-0.1.5.tar.gz`, `meshdrop-ios-0.1.5.tar.gz`,
  `meshdrop-ios-device-app-0.1.5.tar.gz`, `meshdrop-ios-native-source-0.1.5.tar.gz`,
  `meshdrop-ios-simulator-app-0.1.5.tar.gz`, `meshdrop-node-0.1.5.tar.gz`,
  `meshdrop-source-0.1.5.tar.gz`, `meshdrop-spa-0.1.5.tar.gz`,
  `meshdrop-start9-0.1.5.tar.gz`, `meshdrop-umbrel-0.1.5.tar.gz`, and `SHA256SUMS`.
- GHCR target image jobs passed for `start9`, `standalone`, and `umbrel`.
- GHCR tags checked by `release-verify.yml`: `v0.1.5-standalone`, `0.1.5-standalone`, `v0.1.5-start9`,
  `0.1.5-start9`, `v0.1.5-umbrel`, and `0.1.5-umbrel`.
- `release-verify.yml` confirmed `linux/amd64` and `linux/arm64` manifests with GitHub Actions package permissions,
  pulled target metadata, and Docker smoke passed for `ghcr.io/sandwichfarm/meshdrop:v0.1.5-standalone`.
- The same release readback failed at anonymous GHCR manifest readback with `unauthorized`, so the release image target
  remains blocked on public package visibility or an intentional authenticated-only release decision.
