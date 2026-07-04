# Plan: Start9 Package Source Artifact

## Goal

Move the Start9 target from image metadata only to a StartOS package source artifact with deterministic validation, while
keeping `.s9pk`, device install, and transfer UAT explicitly open.

## Scope

- Add StartOS package source templates under `packaging/start9/`.
- Add an artifact builder that renders version/image metadata and creates `meshdrop-start9-<version>.tar.gz`.
- Add tests that inspect the rendered package source for manifest, interfaces, daemon env, npub discovery, admin npub,
  and no static rooms.
- Add the Start9 package-source tarball to release artifacts.
- Update UAT runbooks and target status without claiming real StartOS device support.

## Out of Scope

- Installing StartOS SDK tooling on this machine.
- Building a real `.s9pk` package.
- StartOS device install proof.
- StartOS browser transfer proof.
- Enabling FIPS on StartOS.

## Validation

- `node --test test/start9-package.test.js test/uat-runbooks.test.js test/release-workflow.test.js`
- `npm run build:start9 -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-start9-smoke`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
