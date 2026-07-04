---
status: complete
quick_id: 260704-u4g
slug: prove-start9-s9pk-packaging-with-tar2sqf
date: 2026-07-04
---

# Quick Task 260704-u4g Summary

## Result

Start9 x86_64 `.s9pk` packaging now completes locally without installing AUR `squashfs-tools-ng`. The generated package
ships a `bin/tar2sqfs` fallback that delegates to native `tar2sqfs` when present and otherwise uses `mksquashfs -tar`.

## Evidence

- Generated package `bin/tar2sqfs` is executable: `stat -c '%a %n' bin/tar2sqfs` -> `755 bin/tar2sqfs`.
- `npm run check` passed inside generated package source.
- `npm run build` passed inside generated package source.
- `make x86` passed with isolated `start-cli 0.4.0-beta.10` and produced `meshdrop_x86_64.s9pk`.
- Final artifact: `/tmp/meshdrop-start9-final-uat/meshdrop-start9-0.1.0/meshdrop_x86_64.s9pk`.
- Final SHA-256: `4a166eb17d1b51e09f38b63980dcf3a05acb1b889069d00bcc34ff4c043e91a1`.
- Manifest readback: MeshDrop `0.1.0:0`, `x86_64`, SDK `1.5.3`, image source `packed`.

## Verification

- `node --test test/start9-package.test.js` passed.
- `node --test test/uat-runbooks.test.js test/start9-package.test.js` passed.
- `npm test` passed: 167/167.
- `git diff --check` passed.
- `sh -n packaging/start9/bin/tar2sqfs` passed.
- `npx --yes aislop scan --changes .` passed with 0 issues.
- `npx --yes aislop scan .` still fails on the existing repo baseline: undefined browser globals, existing `innerHTML`
  findings in `public/scripts/ui.js`, and style/complexity warnings.

## Remaining Gap

Start9 target is still not complete. Device install UAT, Nostr WebRTC transfer from a StartOS device, and Pollen transfer
from a StartOS device remain unproven.
