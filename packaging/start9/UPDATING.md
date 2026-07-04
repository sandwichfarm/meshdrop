# Updating MeshDrop for StartOS

## Determining the Upstream Version

- MeshDrop release tags live at https://github.com/sandwichfarm/meshdrop/releases.
- The package image should use `ghcr.io/sandwichfarm/meshdrop:<tag>-start9`.
- The package version should match the MeshDrop alpha release without the leading `v`.

## Applying a Bump

1. Run `npm run build:start9 -- --version <version> --image ghcr.io/sandwichfarm/meshdrop:v<version>-start9`.
2. Inspect `meshdrop-start9-<version>.tar.gz`.
3. Build the package with the StartOS SDK toolchain.
4. Install on a StartOS test device and run `docs/uat/start9.md`.
