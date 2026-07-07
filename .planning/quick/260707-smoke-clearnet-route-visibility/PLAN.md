# Clearnet Route Visibility Smoke Expectations

Goal: repair CI smoke expectations after the Clearnet control became a file-route exclusion control instead of a same-instance discovery-only control.

Scope:
- SPA artifact runtime smoke should expect the Clearnet route control to remain visible when Nostr WebRTC is supported.
- Target artifact runtime smoke should expect the same behavior.
- E2E scenario naming should match the honest Pollen discovery/signaling proof.

Verification:
- `npm run test:spa-artifact`
- `npm run test:target-artifacts`
- `npm run test:e2e`
- `git diff --check`
- AI-slop gates
