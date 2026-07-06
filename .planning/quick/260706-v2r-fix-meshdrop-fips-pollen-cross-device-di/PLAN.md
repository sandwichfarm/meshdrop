---
status: complete
created: 2026-07-06
slug: fix-meshdrop-fips-pollen-cross-device-di
---

# Quick Task: Fix MeshDrop FIPS/Pollen cross-device discovery

## Goal

Make MeshDrop expose real cross-device peer discovery over already-available FIPS and Pollen paths, with trace logs that explain where discovery stops.

## Scope

- Add server-side federation trace logging for FIPS polling, FIPS HTTP discovery, Pollen service registration, Nostr relay subscription, Pollen Nostr announcements, and Pollen service connection.
- Add a Nostr network-tag bootstrap for Pollen federation so peers on the same MeshDrop discovery network can discover each other without manually knowing every target npub.
- Preserve existing direct `p`-tag announcements for configured peer npubs.
- Add focused regression coverage for the new subscription, event tags, and unaddressed network-tag announcements.

## Verification Plan

- Focused federation tests.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .`.
- Rebuild/run local Docker compose and inspect `/config`, `/fips/status`, `/pollen/status`, and logs for trace evidence.

## Known Runtime Evidence Before Fix

- Local FIPS daemon is connected: `fipsctl show status` reports `peer_count: 3`.
- Local MeshDrop logs repeatedly show `FIPS federation discovery failed fetch failed`.
- Pollen bootstrap currently relies on direct `p`-tag announcements, so instances with blank discovery npubs do not discover each other over Nostr.

## Result

- Nostr web-of-trust is the default MeshDrop discovery model.
- FIPS and Pollen are route substrates, not default MeshDrop app discovery sources.
- Generic FIPS/Pollen peers are logged as route candidates and are not probed on port 3000.
- MeshDrop HTTP federation runs only from explicit trusted signed Nostr advertisements.
- `npub-network:unconfigured` is reserved for explicit public/lobby/debug discovery and is not synthesized by default.
- Pollen federation announcements include `pln-node` and `pln-root` so unrelated Pollen clusters are skipped instead of repeatedly attempting impossible service connections.
- Configured Pollen peers can bootstrap one shared Pollen cluster through encrypted, subject-bound Nostr invite events; existing clusters are never destructively purged.
- Draft protocol lives in `nips/meshdrop-pollen-discovery.md`.
