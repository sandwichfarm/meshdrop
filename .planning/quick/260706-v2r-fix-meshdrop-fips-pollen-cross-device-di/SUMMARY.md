# Summary

MeshDrop FIPS/Pollen federation now has a real discovery layer over Nostr:

- FIPS and Pollen publish ephemeral `kind:20385` federation discovery events.
- Pollen service announcements carry `pln-node` and `pln-root`; receivers skip unknown or mismatched clusters and configured peers can join through encrypted Nostr invite events.
- `kind:20385` was selected only after exact live relay checks against `relay.damus.io`, `relay.primal.net`, and `nos.lol`; `20384` was rejected because it was already present on relay history.
- Default instances share `npub-network:unconfigured` instead of deriving one private network per server.
- Federation logs now trace FIPS status, direct FIPS peer probes, Nostr relay subscribe/open/announce, Pollen service registration, Pollen connect, and HTTP federation descriptor discovery.
- The new NIP draft is in `nips/meshdrop-pollen-discovery.md`.

## Evidence

- Focused: `node --test test/federation-server.test.js test/fips-control.test.js` passed 34/34.
- Repo: `npm test` passed 263/263.
- Browser: `npm run test:e2e` passed and proved federated Pollen WebRTC file delivery.
- Docker: `npm run test:docker` passed, including signed admin FIPS save, local WebRTC, Pollen WebRTC, and two-host Nostr WebRTC transfer.
- Changed-code slop: `npx --yes aislop scan --changes .` clean.
- Full-repo slop: `npx --yes aislop scan .` still fails on existing baseline outside touched files.
- Kind check: live REQ for `kind:20385` returned zero events on `relay.damus.io`, `relay.primal.net`, and `nos.lol`.
- Runtime: live compose rebuilt to `meshdrop:local` image `sha256:d3d26201e8794647524003637cba3914e0444d18e6db2db789cdd33647588a7b`; `/fips/status` reports available with connected peers; `/pollen/status` reports available; logs show unknown Pollen clusters are skipped and repeated FIPS Nostr failures are backoff-suppressed.

## Remaining Risk

The second physical MeshDrop instance must run this patched build, or a compatible implementation of `kind:20385`, before it can consume these discovery events. Generic FIPS routers in `fips.yaml` still are not MeshDrop HTTP servers; those probes are now traceable and non-fatal. Automatic Pollen cluster bootstrapping requires configured discovery npubs; `npub-network:unconfigured` can discover announcements but does not auto-issue invites to arbitrary relay listeners.
