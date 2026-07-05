---
status: in-progress
quick_id: 260705-rt0
slug: release-ios-simulator-app-artifact
date: 2026-07-05
---

# Release iOS Simulator App Artifact

## Goal

Make the tagged alpha release ceremony publish and verify the unsigned iOS Simulator app artifact that the current CI
already proves.

## Scope

- Add a macOS release job for `npm run build:ios:simulator-app`.
- Pass the generated tarball into the GitHub release artifact job.
- Extend release readback, workflow tests, and UAT runbook text.
- Do not claim signed iOS device packaging or device UAT.

## Verification

- Focused release workflow tests.
- UAT runbook tests.
- Repo test gate.
- Diff/AI-slop gates.
