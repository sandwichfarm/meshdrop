# Plan: Umbrel Package Artifact

## Goal

Move the Umbrel target from image metadata only to a buildable package artifact with deterministic validation, while
keeping device-install and transfer UAT explicitly open.

## Scope

- Add Umbrel app package templates under `packaging/umbrel/`.
- Add an artifact builder that renders version/image metadata and creates `meshdrop-umbrel-<version>.tar.gz`.
- Add tests that inspect the rendered package for manifest, compose, npub discovery, admin npub, and no static rooms.
- Add the Umbrel package tarball to release artifacts.
- Update UAT runbooks and target status without claiming real Umbrel device support.

## Out of Scope

- Start9 package implementation.
- Umbrel device install proof.
- Umbrel browser transfer proof.
- Multi-architecture release publication.

## Validation

- `node --test test/umbrel-package.test.js test/uat-runbooks.test.js test/release-workflow.test.js`
- `npm run build:umbrel -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-umbrel-smoke`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
