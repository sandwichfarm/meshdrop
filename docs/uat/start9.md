# Start9 UAT Runbook

Use this runbook for the StartOS package source artifact built from `packaging/start9/`.

## Build

1. Run `npm run build:start9 -- --version <version>`.
2. Confirm `dist/meshdrop-start9-<version>.tar.gz` exists.
3. Confirm the archive contains `Makefile`, `package.json`, `instructions.md`, `startos/`, `meshdrop-target.json`, and
   `UAT-START9.md`.
4. In a StartOS packaging workspace with `start-cli`, npm, Docker, and a developer key configured, unpack the artifact
   into a git repository and run:

   ```sh
   npm install --ignore-scripts --no-audit --fund=false
   npm run check
   npm run build
   make
   ```

5. Confirm `make` produces a `.s9pk` package before calling the Start9 package buildable. If native `tar2sqfs` is not
   available, the generated package includes a `bin/tar2sqfs` fallback that uses `mksquashfs -tar`. If the image tag
   points at GHCR, authenticate Docker to GHCR first.

## Package Acceptance

1. Confirm `startos/manifest/index.ts` sets `id: "meshdrop"`, uses the requested start9 image tag, and lists
   `x86_64` plus `aarch64` architectures.
2. Confirm `startos/interfaces.ts` exposes the MeshDrop web UI and Pollen peer interface.
3. Confirm `startos/main.ts` sets `MESHDROP_TARGET=start9`.
4. Confirm `startos/main.ts` exposes `MESHDROP_DISCOVERY_NPUBS` and does not set `NOSTR_ROOM`, `FIPS_ROOM`, or
   `POLLEN_ROOM`.
5. Confirm `startos/main.ts` exposes `MESHDROP_ADMIN_NPUB` for shared-instance server settings.
6. Confirm Pollen is enabled and FIPS is disabled until a StartOS-specific FIPS path is tested.

## Device Acceptance

1. Install the `.s9pk` on a StartOS test device.
2. Open MeshDrop from the StartOS web interface without SSH or manual file edits.
3. Confirm `/config` reports `capabilities.runtime.target` as `start9`.
4. Configure a Nostr identity and transfer a small file over Nostr WebRTC.
5. Configure `MESHDROP_DISCOVERY_NPUBS` for a second MeshDrop instance and confirm Pollen peers appear through
   npub-network discovery.
6. Transfer a small file over Pollen before claiming Pollen works on Start9.
7. If `MESHDROP_ADMIN_NPUB` is configured, confirm admin settings appear only for the configured npub and the backend
   rejects other signers.

## Automated Smoke

Run:

```sh
npm run test:start9-package
```

This smoke builds the local `meshdrop:start9-smoke` image with `MESHDROP_TARGET=start9`, builds and unpacks the Start9
package source artifact, reads the generated `startos/main.ts` environment plus `startos/utils.ts` port, runs the target
image with that generated Start9 environment, confirms `/config` reports `capabilities.runtime.target` as `start9`, and
initiates browser transfers over local WebRTC and Pollen WebRTC.

For package-source shape and typecheck coverage, run:

```sh
npm run build:start9 -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-start9-smoke
node --test test/start9-package.test.js
```

This smoke proves package source artifact shape, root package icon, root license, manifest/version rendering, bundled
`tar2sqfs` fallback executable, image/target metadata, vendored StartOS make plumbing, npub-discovery environment,
admin-npub environment, Pollen enablement, absence of legacy static room environment variables, and generated source
`npm run check` plus `npm run build` against `@start9labs/start-sdk@1.5.3`.

Current local package proof on 2026-07-04:

```sh
start-cli s9pk init-workspace /tmp/meshdrop-start9-uat
docker build -t meshdrop:start9-adapter-proof --build-arg MESHDROP_TARGET=start9 .
npm run build:start9 \
  -- --version 0.1.0 \
  --out-dir /tmp/meshdrop-start9-uat \
  --image meshdrop:start9-adapter-proof
tar -xzf /tmp/meshdrop-start9-uat/meshdrop-start9-0.1.0.tar.gz -C /tmp/meshdrop-start9-uat
cd /tmp/meshdrop-start9-uat/meshdrop-start9-0.1.0
npm install --ignore-scripts --no-audit --fund=false
npm run check
npm run build
git init
git add .
git commit -m "start9 package proof"
make x86
```

`npm run check` and generated-source `npm run build` pass. With isolated `start-cli 0.4.0-beta.10`, a temporary StartOS
workspace, a local `MESHDROP_TARGET=start9` image, temp git metadata, and the generated `bin/tar2sqfs` fallback backed
by host `mksquashfs 4.7.5`, `make x86` produces `meshdrop_x86_64.s9pk`.

Current artifact evidence:

- File: `/tmp/meshdrop-start9-final-uat/meshdrop-start9-0.1.0/meshdrop_x86_64.s9pk`
- Size: `110M`
- SHA-256: `4a166eb17d1b51e09f38b63980dcf3a05acb1b889069d00bcc34ff4c043e91a1`
- Manifest: MeshDrop `0.1.0:0`, `x86_64`, StartOS SDK `1.5.3`, image source `packed`

## Not Proven

- This package-source smoke does not prove installation on a real StartOS device.
- This package-source smoke does not prove browser transfer UAT through a real StartOS device UI.
- FIPS is disabled by default until the target has a tested FIPS binary and device-network path.
