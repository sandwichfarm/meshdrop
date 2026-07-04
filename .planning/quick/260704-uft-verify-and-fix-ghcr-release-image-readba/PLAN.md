---
status: complete
quick_id: 260704-uft
slug: verify-and-fix-ghcr-release-image-readba
date: 2026-07-04
---

# Quick Task 260704-uft: Verify And Fix GHCR Release Image Readback

## Goal

Stop overclaiming release image readiness when local anonymous GHCR reads are denied. Add a release-verification gate
that checks anonymous GHCR manifest readback, and update the UAT ledger with current evidence.

## Tasks

1. Add an anonymous GHCR manifest readback step to `.github/workflows/release-verify.yml`.
2. Update release-target docs and target-status docs to distinguish authenticated workflow proof from anonymous pull proof.
3. Update tests that guard release workflow and UAT documentation.

## Verification

- `node --test test/release-workflow.test.js test/uat-runbooks.test.js` passed: 5/5.
- `npm test` passed: 167/167 after `npm ci` restored lockfile dependencies in this worktree.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-verify.yml")'` passed.
- `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/release-verify.yml` passed.
- `git diff --check` passed.
- `docker manifest inspect ghcr.io/sandwichfarm/meshdrop:v0.1.0-start9` returned `denied`, confirming anonymous
  local readback is not currently proven for the published `v0.1.0` image.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still exits nonzero on the existing repo-wide baseline: undefined browser globals,
  existing `innerHTML` security findings in `public/scripts/ui.js`, and style/complexity warnings.
