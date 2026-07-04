---
status: complete
completed: 2026-07-04
slug: release-smoke-before-anon
---

# Summary: Release Smoke Before Anonymous Gate

## Result

Release readback now runs Docker smoke against the pulled standalone image before the anonymous GHCR visibility gate.

## Changed

- `.github/workflows/release-verify.yml` moves `Run Docker smoke against pulled standalone image` before
  `Verify anonymous GHCR manifests`.
- `test/release-workflow.test.js` enforces that ordering.

## Verification

- Red proof: `node --test test/release-workflow.test.js` failed before the workflow patch because Docker smoke came
  after the anonymous GHCR gate.
- `node --test test/release-workflow.test.js` passed, 5/5.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-verify.yml"); puts "release-verify yaml ok"'` passed.
- `git diff --check` passed.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed, 179/179.
- `npx --yes aislop scan --changes .` passed, but reported `0 changed file(s)`.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 no-undef errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, and existing style/slop warnings.

## Notes

- `actionlint` is not installed locally, so workflow semantic lint was skipped in this worktree.
- This keeps anonymous GHCR verification strict; it still fails until the package is public.
