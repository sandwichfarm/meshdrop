---
status: complete
completed: 2026-07-04
slug: release-anonymous-verifier-ci
---

# Summary: Release Anonymous Verifier CI

## Result

Release verification now reuses the local anonymous GHCR readback verifier instead of duplicating the anonymous manifest loop in GitHub Actions.

## Changed

- `.github/workflows/release-verify.yml` computes `ghcr.io/${GITHUB_REPOSITORY,,}` and invokes
  `MESHDROP_GHCR_IMAGE_BASE="${image_base}" npm run verify:ghcr-anonymous -- "${tag}"`.
- `test/release-workflow.test.js` guards that the workflow calls the shared verifier and no longer contains the old
  anonymous `docker buildx imagetools inspect` loop text.

## Verification

- Red proof: `node --test test/release-workflow.test.js` failed before the workflow patch because the verifier call was missing.
- `node --test test/release-workflow.test.js` passed, 5/5.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-verify.yml"); puts "release-verify yaml ok"'` passed.
- `git diff --check` passed.
- `npm ci` passed with 0 vulnerabilities.
- `npm test` passed, 179/179.
- `npx --yes aislop scan --changes .` passed before staging.
- `npx --yes aislop scan .` ran and failed on the existing full-repo baseline: 461 no-undef errors, 3 `innerHTML`
  security errors in `public/scripts/ui.js`, and existing style/slop warnings.

## Notes

- `actionlint` is not installed locally, so workflow semantic lint was skipped in this worktree.
- This does not change GHCR package visibility or re-run a release tag.
