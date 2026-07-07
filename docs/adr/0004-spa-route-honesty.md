# ADR 0004: SPA Route Honesty Boundary

Date: 2026-07-07

Status: Accepted

## Context

Static MeshDrop artifacts run without the MeshDrop backend. They can still use browser-native routes such as Nostr-discovered WebRTC and browser object-store helpers, but they cannot make backend-only FIPS, Pollen, native, or same-instance transfer claims from target metadata alone.

Route badges, peer descriptors, and package manifests describe possible discovery or target packaging. They are not proof that this browser can move file bytes over that route.

## Decision

Static runtime capability negotiation fails closed for backend-only routes. FIPS, Pollen, and same-instance routes are unsupported in SPA config unless the current runtime exposes a real browser, native, instance, or object-store primitive for that route.

Peer UI uses runtime capabilities before creating selectable route options. Peer-advertised FIPS or Pollen routes may appear as unavailable route attempts, but they do not become selectable file transports without runtime support.

Network route selection uses the same capability boundary. `PeersManager` refuses unsupported backend-only candidates before creating an RTC peer or switching routes.

## Consequences

- Static SPA users still get Nostr WebRTC transfer.
- Backend-only private routes show "Requires instance or native app" instead of pretending to be connected or transferable.
- Manifest booleans, discovery badges, and descriptors cannot enable FIPS or Pollen byte-transfer claims by themselves.
- Future native or instance work must expose a concrete runtime primitive before flipping route support on.

## Verification

- `node --test test/spa-runtime-config.test.js test/spa-artifact.test.js test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js test/route-attempts-ui.test.js`
- `npm run test:spa-artifact`
