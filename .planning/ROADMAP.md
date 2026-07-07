# Roadmap: MeshDrop v0.6.0 Android Native Route Adapter

## Phase 10: Android Native Route Adapter

Goal: wire the installed Android WebView native backend into the route adapter contract and prove bytes move through the native Pollen primitive.

Current status: complete.

Requirements: ANDROID-NATIVE-01, ANDROID-NATIVE-02, ANDROID-NATIVE-03, ANDROID-NATIVE-04, ANDROID-NATIVE-05.

Success criteria:

1. Focused tests fail first because no Android native adapter object exists.
2. Android WebView registers an adapter that passes the generic route adapter contract only when the native backend loopback URL exists.
3. Adapter Pollen send/receive uses the Android backend upload/download primitive and returns validated route proof.
4. Adapter reports FIPS native status separately from Pollen byte-transfer support.
5. Installed APK smoke validates route proof fields from the WebView against the generic route proof contract.

Verification:

- Focused: Android native route adapter unit tests and mobile package artifact tests.
- Runtime: `npm run test:android-fips-pollen`.
- Broad local: `npm test`.
- Hygiene: `git diff --check`.
- AI-slop: `npx --yes aislop scan --changes .`.

## Future Milestone Queue

These are not part of v0.5.0. Start a new GSD milestone for each slice after the previous PR is merged.

1. FIPS instance relay or FIPS stream route proof.
2. Generic instance relay: extend the Pollen-specific relay shape to FIPS, Tor, I2P, Loki, and future backends.
3. Additional networks: add Tor/I2P/Loki/TURN adapters through the same descriptor/scoring/proof model.

---
*Roadmap initialized: 2026-07-07 for milestone v0.5.0 SPA Route Honesty.*
