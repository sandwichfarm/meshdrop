# Summary

MeshDrop FIPS/Pollen federation now has a real discovery layer over Nostr:

- FIPS and Pollen publish ephemeral `kind:20385` federation discovery events.
- `kind:20385` was selected only after exact live relay checks against `relay.damus.io`, `relay.primal.net`, and `nos.lol`; `20384` was rejected because it was already present on relay history.
- Default instances share `npub-network:unconfigured` instead of deriving one private network per server.
- Federation logs now trace FIPS status, direct FIPS peer probes, Nostr relay subscribe/open/announce, Pollen service registration, Pollen connect, and HTTP federation descriptor discovery.
- The new NIP draft is in `nips/meshdrop-pollen-discovery.md`.

## Evidence

- Focused: `node --test test/federation-server.test.js test/fips-control.test.js` passed 30/30.
- Repo: `npm test` passed 259/259.
- Browser: `npm run test:e2e` passed and proved federated Pollen WebRTC file delivery.
- Docker: `npm run test:docker` passed, including signed admin FIPS save, local WebRTC, Pollen WebRTC, and two-host Nostr WebRTC transfer.
- Changed-code slop: `npx --yes aislop scan --changes .` clean.
- Full-repo slop: `npx --yes aislop scan .` still fails on existing baseline outside touched files.
- Runtime: live compose rebuilt to `meshdrop:local` image `sha256:e844f1c7a68864f4020b2db38a9945f5bedd784536d1c0f8794df13b3dc3a071`; `/fips/status` reports available with connected peers; `/pollen/status` reports available; bucket relay returned both FIPS and Pollen `kind:20385` events from the live server.

## Remaining Risk

The second physical MeshDrop instance must run this patched build, or a compatible implementation of `kind:20385`, before it can consume these discovery events. Generic FIPS routers in `fips.yaml` still are not MeshDrop HTTP servers; those probes are now traceable and non-fatal.
