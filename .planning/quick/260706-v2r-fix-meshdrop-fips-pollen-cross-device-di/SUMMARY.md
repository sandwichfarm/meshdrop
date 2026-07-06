# Summary

MeshDrop FIPS/Pollen federation now has a real discovery layer over Nostr:

- FIPS and Pollen publish ephemeral `kind:20385` federation discovery events.
- Pollen service announcements carry `pln-node` and `pln-root`; receivers skip unknown or mismatched clusters and configured peers can join through encrypted Nostr invite events.
- `kind:20385` was selected only after exact live relay checks against `relay.damus.io`, `relay.primal.net`, and `nos.lol`; `20384` was rejected because it was already present on relay history.
- Default instances share `npub-network:unconfigured` instead of deriving one private network per server.
- Federation logs now trace FIPS status, direct FIPS peer probes, Nostr relay subscribe/open/announce, Pollen service registration, Pollen connect, and HTTP federation descriptor discovery.
- The new NIP draft is in `nips/meshdrop-pollen-discovery.md`.

Follow-up correction for the runtime model:

- Generic FIPS peers from `fips.yaml` are no longer treated as MeshDrop HTTP servers and are not probed at `http://[peer]:3000`.
- FIPS peer status is logged as `fips route candidate` only; MeshDrop HTTP federation is attempted only from explicit MeshDrop advertisements, such as Nostr federation events or a verified Pollen proxy.
- Browser Nostr WebRTC discovery is visible again in the Network group with the old WebRTC icon and the label `Nostr`.
- Browser Nostr discovery now uses a shared room tag instead of requiring follow-only `p` addressed presence, so two same-room instances can see each other through the configured WebRTC relay.
- The footer discovery badge now says `Nostr`, not `Relay`.

## Evidence

- Focused: `node --test test/federation-server.test.js test/fips-control.test.js` passed 34/34 before the follow-up correction.
- Focused follow-up: `node --test test/nostr-mesh-protocol.test.js test/nostr-discovery-protocol.test.js test/header-copy.test.js test/action-visibility.test.js test/peer-availability-protocol.test.js test/federation-server.test.js test/signaling-room-priority.test.js` passed 95/95.
- Repo: `npm test` passed 265/265.
- Browser: `npm run test:e2e` passed and proved local WebRTC, FIPS WebRTC, Pollen WebRTC, Nostr WebRTC, generic FIPS route-candidate-only behavior, and federated Pollen WebRTC file delivery.
- Docker: `npm run test:docker` passed, including signed admin FIPS save, local WebRTC, Pollen WebRTC, and two-host Nostr WebRTC transfer.
- Changed-code slop: `npx --yes aislop scan --changes .` exited 0 with no formatting, lint, security, or AI-slop issues; remaining warnings are existing size/long-function policy warnings in touched large scripts.
- Full-repo slop: `npx --yes aislop scan .` still fails on existing baseline outside touched files.
- Kind check: live REQ for `kind:20385` returned zero events on `relay.damus.io`, `relay.primal.net`, and `nos.lol`.
- Runtime: live compose rebuilt to `meshdrop:local` image `sha256:d3d26201e8794647524003637cba3914e0444d18e6db2db789cdd33647588a7b`; `/fips/status` reports available with connected peers; `/pollen/status` reports available; logs show unknown Pollen clusters are skipped and repeated FIPS Nostr failures are backoff-suppressed.
- CI follow-up: GitHub job logs for run `28826300435` showed `Target artifact transfer smoke` timing out on stale shared-room Nostr peers from a prior target artifact and `Browser transfer smoke` exiting on an unhandled fake FIPS socket `ECONNRESET`. The smoke helpers now select an actually connected peer when stale same-room presence exists, and the fake FIPS control socket ignores normal client reset during shutdown.
- CI follow-up proof: `npm run test:target-artifacts`, `npm run test:e2e`, and `npm run test:spa-artifact` all pass after the harness fix.

## Remaining Risk

The second physical MeshDrop instance must run this patched build before it can use shared-room Nostr WebRTC discovery and the route-candidate-only FIPS behavior. Generic FIPS routers in `fips.yaml` are intentionally not MeshDrop HTTP servers. Automatic Pollen cluster bootstrapping requires configured discovery npubs; `npub-network:unconfigured` can discover announcements but does not auto-issue invites to arbitrary relay listeners.
