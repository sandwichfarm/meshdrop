# Start9 UAT Runbook

Use this runbook for the StartOS package source artifact built from `packaging/start9/`.

## Build

1. Run `npm run build:start9 -- --version <version>`.
2. Confirm `dist/meshdrop-start9-<version>.tar.gz` exists.
3. Confirm the archive contains `Makefile`, `package.json`, `instructions.md`, `startos/`, `meshdrop-target.json`, and
   `UAT-START9.md`.
4. In a StartOS packaging workspace with `start-cli`, `tar2sqfs`, npm, Docker, and a developer key configured, unpack
   the artifact into a git repository and run:

   ```sh
   npm install --ignore-scripts --no-audit --fund=false
   npm run check
   npm run build
   make
   ```

5. Confirm `make` produces a `.s9pk` package before calling the Start9 package buildable. If the image tag points at
   GHCR, authenticate Docker to GHCR first.

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
npm run build:start9 -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-start9-smoke
node --test test/start9-package.test.js
```

This smoke proves package source artifact shape, root package icon, root license, manifest/version rendering,
image/target metadata, vendored StartOS make plumbing, npub-discovery environment, admin-npub environment, Pollen
enablement, absence of legacy static room environment variables, and generated source `npm run check` plus
`npm run build` against
`@start9labs/start-sdk@1.5.3`.

Current local package proof on 2026-07-04:

```sh
start-cli s9pk init-workspace /tmp/meshdrop-start9-uat
docker build -t meshdrop:start9-s9pk-proof --build-arg MESHDROP_TARGET=start9 .
npm run build:start9 \
  -- --version 0.1.0 \
  --out-dir /tmp/meshdrop-start9-uat \
  --image meshdrop:start9-s9pk-proof
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
workspace, a local `MESHDROP_TARGET=start9` image, and temp git metadata, `make x86` reaches the squashfs packaging step.
It stops on this host because `tar2sqfs` is not installed. Arch official repos only provide `squashfs-tools`; `tar2sqfs`
is available here only through the AUR `squashfs-tools-ng` package, which was not installed during this run.

## Not Proven

- This package-source smoke does not prove an `.s9pk` build.
- This package-source smoke does not prove `start-cli s9pk pack` completion because this host does not have `tar2sqfs`.
- This package-source smoke does not prove installation on a real StartOS device.
- This package-source smoke does not prove browser transfer UAT on StartOS.
- FIPS is disabled by default until the target has a tested FIPS binary and device-network path.
