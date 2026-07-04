---
status: complete
completed: 2026-07-05
slug: release-v012-status
---

# Summary: Release v0.1.2 Status

## Result

Release UAT docs now point at the current `v0.1.2` evidence instead of stale `v0.1.0` release-image status.

## Changed

- `docs/uat/release-target-images.md` records `v0.1.2` assets, GHCR target image jobs, authenticated manifest readback,
  Docker smoke proof, and the anonymous GHCR `unauthorized` blocker.
- `docs/uat/target-status.md` records the same release-image boundary.
- `test/uat-runbooks.test.js` guards the current `v0.1.2` evidence so the release ledger does not drift stale again.

## Evidence

- Red proof: `node --test test/uat-runbooks.test.js` failed while the docs still required `v0.1.0`.
- `gh release view v0.1.2 --repo sandwichfarm/meshdrop` showed all expected release assets.
- `gh run view 28721154277 --repo sandwichfarm/meshdrop` showed GHCR target image jobs passed for `start9`,
  `standalone`, and `umbrel`; release readback failed only at anonymous GHCR.
- Release readback logs showed Docker smoke proof for `ghcr.io/sandwichfarm/meshdrop:v0.1.2-standalone`, followed by
  anonymous GHCR `unauthorized`.
- `node --test test/uat-runbooks.test.js` passed after the docs update.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed, 179/179.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed, but reported `0 changed file(s)`.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 `no-undef` errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, and existing style/slop warnings.

## Remaining Risk

- Anonymous GHCR readback still fails until `ghcr.io/sandwichfarm/meshdrop` is public.
- Native desktop/mobile shells and StartOS/Umbrel device UAT remain open.
