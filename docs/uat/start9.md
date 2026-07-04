# Start9 UAT Runbook

Use this runbook for the StartOS package source artifact built from `packaging/start9/`.

## Build

1. Run `npm run build:start9 -- --version <version>`.
2. Confirm `dist/meshdrop-start9-<version>.tar.gz` exists.
3. Confirm the archive contains `Makefile`, `package.json`, `instructions.md`, `startos/`, `meshdrop-target.json`, and
   `UAT-START9.md`.
4. In a StartOS packaging workspace with `start-cli`, npm, and a developer key configured, unpack the artifact and run:

   ```sh
   npm install
   npm run check
   make
   ```

5. Confirm `make` produces a `.s9pk` package before calling the Start9 target buildable.

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

This smoke proves package source artifact shape, manifest rendering, image/target metadata, npub-discovery environment,
admin-npub environment, Pollen enablement, and the absence of legacy static room environment variables.

## Not Proven

- This package-source smoke does not prove an `.s9pk` build.
- This package-source smoke does not prove installation on a real StartOS device.
- This package-source smoke does not prove browser transfer UAT on StartOS.
- FIPS is disabled by default until the target has a tested FIPS binary and device-network path.
