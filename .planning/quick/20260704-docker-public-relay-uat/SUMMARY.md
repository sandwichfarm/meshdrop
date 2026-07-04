---
status: complete
date: 2026-07-04
slug: docker-public-relay-uat
---

# Docker public relay UAT

## Summary

Docker public relay UAT is now backed by a passing GitHub Actions manual run against `wss://bucket.coracle.social`.
The UAT harness waits for both RTC data channels, records request/accept/sent debug state, and retries public relay
attempts while keeping the deterministic fake-relay smoke single-attempt.

## Evidence

- Failed baseline: manual run `28714882735` timed out after RTC connected but before `files-received`.
- Local deterministic proof: `Proof docker-two-host-nostr-webrtc: nostr delivered meshdrop-proof-icon.svg between two Docker instances`.
- Local public relay proof: `Proof docker-public-relay-two-host-webrtc: nostr delivered meshdrop-proof-icon.svg between two Docker instances`.
- PR CI run `28715161999` passed unit, browser transfer, SPA browser matrix, and Docker smoke jobs.
- Manual branch run `28715209725` passed Docker public relay UAT; attempt 1 timed out waiting for an open RTC peer,
  attempt 2 emitted the required public proof line.
- `npm test` passed 166/166.
- `npx --yes aislop scan --changes .` passed clean.

## Remaining

- Real deployed-admin Docker UAT remains open.
- WebKit SPA transfer UAT remains open.
- Full-repo `aislop` baseline still fails on existing browser globals, `innerHTML` findings, duplicate blocks, large
  files, and console/comment warnings outside this change.
