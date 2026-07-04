---
status: complete
---

# Summary

## Change

- Added Docker UAT instructions tied to `npm run test:docker`, compose env, signed admin npub config, and runtime acceptance.
- Added release target image UAT instructions for `standalone`, `start9`, and `umbrel` GHCR image tags and metadata.
- Added a target status ledger that marks SPA/Docker as smoke-proven, Start9/Umbrel as image-metadata-only,
  and Desktop/iOS/Android as not implemented.
- Added `test/uat-runbooks.test.js` to require these docs and prevent target-complete overclaims.

## Evidence

- Red proof: `node --test test/uat-runbooks.test.js` failed before docs existed with `docs/uat/docker.md must exist`.
- `node --test test/uat-runbooks.test.js` passed: 1/1.
- First `npm test` failed before code execution because this fresh worktree had no `node_modules`.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed: 158/158.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 but reported `0 changed file(s)`, so it did not provide meaningful coverage for this docs/test diff.
- `npx --yes aislop scan .` exited 1 on the existing repo-wide baseline: 461 no-undef errors,
  3 direct `innerHTML` security findings in `public/scripts/ui.js`, console/trivial-comment warnings,
  duplicate-code warnings, and file-size warnings.

## Known Gaps

- No new runtime target was implemented in this slice.
- No real `v0.*.*` release tag was pushed, so GHCR publication is still not registry-proven.
- Desktop Native, iOS, Android, real Start9 package manifests, and real Umbrel package manifests remain unimplemented.
