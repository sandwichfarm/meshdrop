# Umbrel UAT Runbook

Use this runbook for the Umbrel app package artifact built from `packaging/umbrel/`.

## Build

1. Run `npm run build:umbrel -- --version <version>`.
2. Confirm `dist/meshdrop-umbrel-<version>.tar.gz` exists.
3. Confirm the archive contains `umbrel-app.yml`, `docker-compose.yml`, `meshdrop-target.json`, and `UAT-UMBREL.md`.

## Package Acceptance

1. Confirm `umbrel-app.yml` uses `manifestVersion: 1`, `id: meshdrop`, `port: 3000`, and the requested version.
2. Confirm `docker-compose.yml` uses the `ghcr.io/sandwichfarm/meshdrop:<tag>-umbrel` image.
3. Confirm compose sets `MESHDROP_TARGET=umbrel`.
4. Confirm compose does not expose static discovery npubs and does not set `NOSTR_ROOM`, `FIPS_ROOM`, or `POLLEN_ROOM`.
5. Confirm compose exposes `MESHDROP_ADMIN_NPUB` for shared-instance server settings.
6. Confirm Pollen is enabled and persistent state is mounted under `${APP_DATA_DIR}/data`.

## Device Acceptance

1. Install the package on an Umbrel test node.
2. Open MeshDrop from the Umbrel UI without SSH or manual file edits.
3. Confirm `/config` reports `capabilities.runtime.target` as `umbrel`.
4. Configure a Nostr identity and transfer a small file over Nostr WebRTC.
5. Sign in with a Nostr identity that follows the target user, confirm NIP-65 relays are loaded from bootstrap relays, and confirm Pollen peers appear through runtime npub-network discovery.
6. Transfer a small file over Pollen before claiming Pollen works on Umbrel.
7. If `MESHDROP_ADMIN_NPUB` is configured, confirm admin settings appear only for the configured npub and the backend rejects other signers.

## Automated Smoke

Run:

```sh
npm run test:umbrel-package
```

This smoke builds the local `meshdrop:umbrel-smoke` image with `MESHDROP_TARGET=umbrel`, builds and unpacks the
Umbrel package, runs the rendered package `docker-compose.yml`, confirms `/config` reports
`capabilities.runtime.target` as `umbrel`, and initiates browser transfers over local WebRTC and Pollen WebRTC.

## Real Node UAT

After installing the generated Umbrel package through the Umbrel UI, run:

```sh
MESHDROP_UMBREL_UAT_URL=https://<umbrel-meshdrop-url> npm run test:umbrel-deployed
```

This harness fails closed unless `MESHDROP_UMBREL_UAT_URL` is set. It reads the installed service `/config`, confirms
the runtime target is `umbrel`, confirms backend and Pollen capability negotiation, keeps FIPS disabled until a real
device-network FIPS path exists, and initiates local plus Pollen WebRTC transfers through the installed Umbrel UI.
Passing output must include `Proof umbrel-deployed-device-webrtc`.

For a package-shape-only check, run:

```sh
npm run build:umbrel -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-umbrel-smoke
node --test test/umbrel-package.test.js
```

This smoke proves package artifact shape, manifest rendering, compose image/target metadata, browser Nostr WOT discovery
metadata, admin-npub environment, and the absence of static discovery room environment variables.

## Not Proven

- This package smoke does not prove installation on a real Umbrel node.
- This package smoke does not prove browser transfer UAT through a real Umbrel node UI; that requires
  `MESHDROP_UMBREL_UAT_URL=<url> npm run test:umbrel-deployed` to pass after UI install.
- FIPS is disabled by default in the Umbrel package until the target has a tested FIPS binary and device-network path.
