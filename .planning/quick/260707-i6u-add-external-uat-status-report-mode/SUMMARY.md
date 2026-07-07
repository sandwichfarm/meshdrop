---
quick_id: 260707-i6u
slug: add-external-uat-status-report-mode
date: 2026-07-07
status: complete
---

# Summary

Added an external-UAT status/report mode so the remaining Start9, Umbrel, iOS signed-device, and GHCR anonymous-readback blockers can be captured as a durable handoff artifact before the final hardware/node run.

The final gate still fails closed. `npm run test:external-uat -- v0.1.5 --report /tmp/meshdrop-external-uat-final.json` executes the ready GHCR anonymous check, records failed/blocked status, and still exits nonzero until all four external checks pass.

## Changed

- Added `--status`, `--json`, and `--report <path>` handling to `scripts/external-uat-finishline.mjs`.
- Added `status:external-uat` package script for non-mutating closeout reports.
- Added focused tests for argument parsing, status mode, report formatting, and GHCR failure action text.
- Updated external closeout docs and target-status ledger to use status/final JSON reports.

## Verification

- `node --test test/external-uat-finishline.test.js test/uat-runbooks.test.js` -> 10/10 pass.
- `npm run status:external-uat -- v0.1.5 --report /tmp/meshdrop-external-uat-status.json` -> expected exit 1; status report recorded 3 blocked checks and 1 ready GHCR check.
- `npm run test:external-uat -- v0.1.5 --report /tmp/meshdrop-external-uat-final.json` -> expected exit 1; final report recorded Start9/Umbrel/iOS blocked and GHCR anonymous failed with `unauthorized`.
- `npm test` -> 311/311 pass after `npm ci` in the task worktree.
- `git diff --check` -> clean.
- `npx --yes aislop scan --changes .` -> clean.
- `npx --yes aislop scan .` -> exit 1 on pre-existing full-repo baseline warnings in vendored noble files, oversized files, duplicate `network.js` blocks, `server/nostr-identity.js` hardcoded URL, TODO/empty-function info.

## Known Gap

External finish-line completion remains blocked by missing StartOS/Umbrel service URLs, macOS/Xcode/iOS device inputs, and GHCR public visibility or an explicit authenticated-only release policy.
