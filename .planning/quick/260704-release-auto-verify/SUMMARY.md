---
status: complete
completed: 2026-07-04
slug: release-auto-verify
---

# Summary: Release Auto Verify

## Result

Tagged alpha releases now call the release readback verifier automatically after all GHCR target image jobs complete.

## Changed

- `.github/workflows/release-verify.yml` now supports `workflow_call` with the same required `tag` input as manual dispatch.
- `.github/workflows/release.yml` adds a `verify-release` job that depends on `container-images` and calls
  `./.github/workflows/release-verify.yml` with `${{ github.ref_name }}`.
- `test/release-workflow.test.js` guards the reusable verifier trigger and release job dependency.

## Verification

- Red proof: `node --test test/release-workflow.test.js` failed before the workflow patch because `verify-release` and
  `workflow_call` were missing.
- `node --test test/release-workflow.test.js` passed, 5/5.
- `ruby -e 'require "yaml"; %w[.github/workflows/release.yml .github/workflows/release-verify.yml].each { |p| YAML.load_file(p); puts "#{p} yaml ok" }'` passed.
- `git diff --check` passed.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed, 179/179.
- `npx --yes aislop scan --changes .` passed, but reported `0 changed file(s)`.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 no-undef errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, and existing style/slop warnings.

## Notes

- `actionlint` is not installed locally, so workflow semantic lint was skipped in this worktree.
- This does not cut a release tag or change GHCR package visibility.
