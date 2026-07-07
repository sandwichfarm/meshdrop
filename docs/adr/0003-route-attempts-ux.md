# ADR 0003: Route Attempts UX Boundary

Date: 2026-07-07

Status: Accepted

## Context

MeshDrop now has route descriptors, scoring reasons, and proof fields, but most visible route state still appears as terse badges or connection text. Badges can describe discovery or signaling, while the product promise depends on which route actually carried verified file bytes.

Users need route state they can act on: which path is being tried, why a route is unavailable or failed, what privacy posture applies, and whether completion is proven by byte/hash evidence. They should not need to understand route descriptors, ICE internals, FIPS npubs, or Pollen service metadata.

## Decision

Route-attempt UI is a presentation layer over existing route status and proof events.

`peer-route-status` events map to user-facing route attempts with:

- route label,
- route state,
- unavailable or failure reason,
- privacy/data-path labels.

Transfer proof maps to completed route summaries only when proof shows matching sent/received bytes, `hashMatched: true`, and `fallbackUsed: false`. Discovery, descriptor exchange, route candidates, or transport badges cannot render as successful transfer proof.

Backend-only routes remain disabled/hidden unless runtime capability and transfer primitive evidence exist for the current target. The UI can say "Requires instance" or "Requires native app" without exposing backend descriptor internals.

## Consequences

- Existing transfer flows remain unchanged; the UI consumes their current status/proof surfaces.
- Route choice dialogs can show attempt metadata before a user chooses a route.
- Peer cards can show compact route attempt details while connecting or when a route is unavailable.
- Later SPA/native/FIPS slices can reuse the same presenter instead of creating new protocol-specific UI language.

## Verification

- `node --test test/route-attempts-ui.test.js test/peer-availability-protocol.test.js test/route-contract.test.js`
- `npm run test:e2e`
