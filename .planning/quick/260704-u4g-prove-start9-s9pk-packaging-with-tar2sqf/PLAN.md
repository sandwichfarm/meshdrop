---
status: in_progress
quick_id: 260704-u4g
slug: prove-start9-s9pk-packaging-with-tar2sqf
date: 2026-07-04
---

# Quick Task 260704-u4g: Prove Start9 s9pk packaging with tar2sqfs

## Goal

Move the Start9 target one step closer to complete by proving `.s9pk` packaging when possible, without installing host
packages or compiling AUR/source dependencies without explicit approval.

## Tasks

1. Reproduce the current generated Start9 package source from this branch and rerun the local package checks.
2. Inspect how `start-cli s9pk pack` invokes `tar2sqfs`, using a temporary shim only for diagnostics.
3. If a safe temporary prebuilt `tar2sqfs` path is available, use it to produce `.s9pk`; otherwise update GSD/docs with
   the exact blocker and next viable path.

## Verification

- `node --test test/start9-package.test.js`
- Generated package `npm run check`
- Generated package `npm run build`
- `make x86` result, including either `.s9pk` file evidence or exact `tar2sqfs` blocker evidence
- Standard repo gates before commit if files change
