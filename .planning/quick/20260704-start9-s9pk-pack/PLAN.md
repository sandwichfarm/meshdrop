---
status: complete
created: 2026-07-04
slug: start9-s9pk-pack
---

# Start9 S9PK Pack

## Target

Move Start9 from generated-source typecheck to actual `.s9pk` package creation proof.

## Red Proof

With isolated `start-cli` from `start-cli/v1.0.0`, the generated package reaches the real pack command and fails:

```sh
start-cli s9pk pack --arch=x86_64 -o meshdrop_x86_64.s9pk
```

Current blockers:

- `start-cli` requires `javascript/index.js`, but `npm run build` emits `dist/index.js`.
- The package source has no root `icon.png`.

## Plan

- [x] Emit generated StartOS JavaScript to `javascript/`.
- [x] Make the vendored make plumbing build `javascript/index.js` before pack, without relying on `list-ingredients` when the
  manifest cannot load yet.
- [x] Include a root `icon.png` in the generated package source.
- [x] Include root `LICENSE` and StartOS version graph metadata.
- [x] Extend the Start9 package test to lock these package prerequisites.
- [x] Run isolated `make x86` with temp-home `start-cli`; keep device install and transfer UAT as explicit gaps.

## Result

Generated package source now:

- typechecks with `npm run check`;
- emits `javascript/index.js` with `npm run build`;
- includes root `icon.png`, root `LICENSE`, and `startos/versions`;
- reaches the `start-cli s9pk pack` squashfs packaging step in a temp StartOS workspace with a locally built
  `MESHDROP_TARGET=start9` image.

Remaining blocker for `.s9pk` proof on this host: `tar2sqfs` is missing. Arch official repos provide `squashfs-tools`,
but `tar2sqfs` is from AUR `squashfs-tools-ng`, which was inspected but not installed.
