---
status: complete
completed: "2026-07-08T02:38:55+02:00"
---

# Route Status Polish Summary

Route attempt badges now lean harder on iconography and motion instead of visible status words.

## Changed

- Enlarged compact route chips while keeping them fixed-size and wordless.
- Added a subtle sweep animation for pending FIPS/Pollen chips, with Pollen staggered so both do not pulse in lockstep.
- Made blocked Clearnet lower opacity and desaturated while keeping the strike mark.
- Bumped the service worker cache version through the build script so stale cached CSS is replaced.
- Added focused UI coverage for the motion-first CSS and cache-bust contract.

## Evidence

- `node --test test/route-attempts-ui.test.js` passed 11/11.
- Browser proof at `/tmp/meshdrop-route-status-polish-mobile-dark.png`: visible text was only `NADAR2`, route chip text was empty, Clearnet opacity was `0.34`, FIPS had `route-chip-sweep`, Pollen had staggered delay `0.16s`.
- `npm test` passed 376/376.
- `MESH_DROP_CACHE_VERSION=v1.11.9-route-status-polish-verified npm run build:service-worker` passed and wrote the cache version.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed with no findings.

## Remaining Risk

- Full-repo slop scan was not run for this narrow UI-only slice.
- The first service-worker build attempt used the already-present cache version and failed because the script requires an actual replacement; rerun with the `-verified` suffix passed.
