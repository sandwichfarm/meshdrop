# 20260704 SPA Public Relay UAT Plan

## Goal

Move the SPA public relay gap from “no proof path” to an explicit UAT harness that can initiate a real WebRTC transfer
through public Nostr relay infrastructure.

## Scope

- Keep the deterministic local fake-relay SPA artifact smoke as the default CI path.
- Add an opt-in public relay mode using `MESHDROP_SPA_PUBLIC_RELAY_URLS`.
- Sign Nostr mesh events with valid generated keys so public relays can accept the proof events.
- Add a manual GitHub Actions path for Chromium/Firefox public relay UAT without running it on every PR or push.
- Record only verified proof; do not call WebKit transfer or Firefox public relay complete without readback.

## Validation

- `npm test`
- `git diff --check`
- Workflow YAML parses.
- Local Chromium public relay run transfers `meshdrop-spa-proof.txt` through `wss://bucket.coracle.social`.
- GitHub PR checks pass before merge.
- After merge, dispatch manual `CI` workflow with `spa_public_relay_urls` to collect GitHub-hosted Chromium/Firefox proof.
