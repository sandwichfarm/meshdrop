---
status: complete
quick_id: 260705-3ni
slug: record-v014-release-proof
date: 2026-07-05
---

# Quick Task 260705-3ni: Record v0.1.4 release proof

## Summary

- Cut and pushed alpha tag `v0.1.4` from green `master` commit `bd8f549`.
- Release run `28724437334` created GitHub release assets, including `meshdrop-android-apk-0.1.4.tar.gz`.
- GHCR target image jobs passed for `standalone`, `start9`, and `umbrel`.
- Release readback passed GitHub release asset verification, authenticated GHCR multi-arch manifests, pulled target
  metadata, and Docker smoke against `ghcr.io/sandwichfarm/meshdrop:v0.1.4-standalone`.
- Release readback failed only at the strict anonymous GHCR manifest gate with `unauthorized`.

## Verification

- `gh release view v0.1.4 --repo sandwichfarm/meshdrop --json ...` confirmed the live prerelease and asset list.
- `gh run watch 28724437334 --repo sandwichfarm/meshdrop --exit-status` reached the expected failure at anonymous GHCR.
- `gh run view 28724437334 --repo sandwichfarm/meshdrop --job 85179445947 --log-failed` showed Docker smoke proof and
  `Get "https://ghcr.io/v2/sandwichfarm/meshdrop/manifests/v0.1.4-standalone": unauthorized`.
- `node --test test/uat-runbooks.test.js` passed.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` ran and failed on the existing repo-wide baseline: 461 `no-undef` browser global errors,
  3 existing `innerHTML` security findings in `public/scripts/ui.js`, plus existing size/duplicate/console/comment
  warnings.

## Remaining Gaps

- Anonymous GHCR manifest readback remains blocked until `ghcr.io/sandwichfarm/meshdrop` is public.
- Android device/emulator install UAT, native mobile transfer UAT, file picker/share sheet, Bluetooth, and signed
  mobile release packages remain open.
