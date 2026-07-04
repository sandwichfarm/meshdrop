# Summary: Umbrel Package Artifact

## Changed

- Added `packaging/umbrel/` with `umbrel-app.yml` and `docker-compose.yml` templates.
- Added `scripts/build-umbrel-package.mjs` and `npm run build:umbrel`.
- Added package artifact assertions in `test/umbrel-package.test.js`.
- Added `docs/uat/umbrel.md` and updated target/release UAT docs.
- Wired the Umbrel package tarball into the alpha release workflow.

## Remaining

- Real Umbrel node install UAT.
- Umbrel WebRTC and Pollen transfer UAT on device.
- Start9 package implementation remains image-metadata only.
