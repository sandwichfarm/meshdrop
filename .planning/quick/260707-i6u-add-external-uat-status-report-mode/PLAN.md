---
quick_id: 260707-i6u
slug: add-external-uat-status-report-mode
date: 2026-07-07
status: complete
---

# Quick Task 260707-i6u: Add External UAT Status Report Mode

## Goal

Make the remaining external finish-line blockers durable and operator-readable without spending a full CI run or requiring StartOS/Umbrel/iOS hardware to be present.

## Constraints

- Do not weaken the final `npm run test:external-uat -- v0.x.y` gate.
- Do not record secrets in status artifacts.
- Keep the normal finish-line command fail-loud until Start9, Umbrel, iOS signed-device, and GHCR anonymous readback all pass.
- Avoid full CI for this tooling/docs slice; use focused script tests plus local status proof.

## Tasks

1. Add red/green coverage for external-UAT status/report output.
2. Add CLI flags to `scripts/external-uat-finishline.mjs`:
   - `--status` for non-mutating closeout status.
   - `--json` for machine-readable stdout.
   - `--report <path>` for durable JSON handoff artifacts.
3. Add a package script for the non-mutating status command.
4. Update closeout docs and target-status ledger with the new command.
5. Verify with focused tests, live blocker status, diff check, and changed-code slop scan.
