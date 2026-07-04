# Add platform UAT runbook coverage

## Problem

The finish-line goal requires every target platform to build, have UAT runbooks, and work with near certainty.
Current documentation only has the static SPA UAT runbook, while Docker and release target image proof now exist in code and CI.

## Scope

- Add a focused guard that fails when required target UAT docs are missing or overclaim unsupported targets.
- Add Docker runtime UAT instructions tied to the existing Docker smoke path.
- Add release target image UAT instructions for `standalone`, `start9`, and `umbrel` image metadata.
- Add a target status ledger so unimplemented Desktop/Mobile/native package targets are explicit and cannot be mistaken for complete.

## Out Of Scope

- Implementing Desktop Native, iOS, Android, Start9 package manifests, or Umbrel package manifests.
- Pushing a real `v0.*.*` release tag or proving GHCR registry publication.
- Changing WebRTC/discovery/runtime code.

## Verification Plan

- Red/green `node --test test/uat-runbooks.test.js`.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
