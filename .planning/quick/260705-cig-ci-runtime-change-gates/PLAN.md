---
status: complete
created: 2026-07-05
slug: ci-runtime-change-gates
---

# Quick Task: CI Runtime Change Gates

## Goal

Avoid running heavyweight browser, emulator, Docker, and target artifact jobs when a PR only changes workflow/test guardrails.

## Scope

- Add a first-party CI change classifier.
- Keep manual workflow dispatches running heavyweight jobs.
- Gate runtime smoke jobs only when app, server, packaging, runtime smoke tests, package, or Docker paths changed.
- Preserve unit tests as the always-on validation surface for non-ignored PRs.
- Add regression assertions for the classifier and gated jobs.

## Out Of Scope

- Changing release workflows.
- Weakening runtime proof for app/runtime code changes.
- Solving hardware UAT or GHCR package visibility blockers.

## Validation

- Red/green focused CI workflow test.
- Workflow syntax/actionlint.
- Repo test gate.
- Diff and AI-slop gates.
