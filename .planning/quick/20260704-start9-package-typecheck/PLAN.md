---
status: complete
created: 2026-07-04
slug: start9-package-typecheck
---

# Start9 Package Typecheck

## Target

Move the Start9 target toward `.s9pk` proof by first making the generated StartOS package source compile with the
declared `@start9labs/start-sdk` dependency.

## Red Proof

`npm run build:start9 -- --version 0.0.0-smoke --out-dir /tmp/meshdrop-start9-uat`, followed by unpacking the artifact,
`npm install`, and `npm run check` fails before `make`:

- NodeNext rejects extensionless relative imports.
- `@start9labs/start-sdk@1.5.3` does not export `setupSdk`; it expects `StartSdk.of().withManifest(manifest).build(true)`.

## Plan

- [x] Patch generated StartOS source imports to satisfy NodeNext.
- [x] Use the SDK API exposed by `@start9labs/start-sdk@1.5.3`.
- [x] Vendor the current StartOS package `s9pk.mk` plumbing instead of including the not-yet-shipped SDK path.
- [x] Extend the Start9 package test so it proves generated package source `npm run check` passes.
- [x] Retry `make`; record whether `.s9pk` is now reachable or the next toolchain blocker appears.

## Result

Generated source now passes `npm run check`. `make` reaches:

```sh
start-cli s9pk pack --arch=x86_64 -o meshdrop_x86_64.s9pk
```

This host does not have `start-cli`, so `.s9pk` proof remains blocked at the local toolchain boundary.
