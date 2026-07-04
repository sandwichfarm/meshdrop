# External Integrations

**Analysis Date:** 2026-07-04

## APIs & External Services

**Nostr relays:**
- Purpose: Nostr mesh discovery and Pollen federation announcements.
- Code: `server/index.js`, `server/federation.js`, `server/nostr-identity.js`, `public/scripts/nostr-mesh.js`, `public/scripts/nostr-relays.js`, `public/scripts/nostr-identity.js`.
- Default: `wss://bucket.coracle.social` via `NOSTR_RELAYS`.
- Auth: signed Nostr events using `nostr-tools`; server federation secret can come from `MESHDROP_NOSTR_SECRET_KEY` or persisted under `PLN_DIR`.

**FIPS daemon:**
- Purpose: peer discovery and transport across the FIPS mesh.
- Code: `server/fips-control.js`, `server/federation.js`, `public/scripts/fips-discovery.js`.
- Control: TCP host/port or Unix socket via `FIPS_CONTROL_HOST`, `FIPS_CONTROL_SOCKET`, and `FIPS_CONTROL_TIMEOUT_MS`.
- Docker: `docker-compose.yml` mounts `/usr/bin/fips`, `/usr/bin/fipsctl`, `fips.yaml`, `/dev/net/tun`, and grants `NET_ADMIN`.
- Published ports: `2121/udp` and `8443/tcp`.

**Pollen / pln:**
- Purpose: storage-backed transfer and federation over Pollen services.
- Code: `server/pollen-transfer.js`, `server/federation.js`, `public/scripts/pollen-transfer.js`.
- Commands: `pln version --short`, `pln status`, `pln seed -`, `pln fetch`, `pln serve`, and `pln connect`.
- Configuration: `POLLEN_TRANSFER`, `PLN_BIN`, `PLN_DIR`, `POLLEN_PORT`, `POLLEN_MAX_UPLOAD_BYTES`, `POLLEN_ROOM`.
- Docker: `pollen-data` volume stores `/var/lib/meshdrop/pln`; `60611/udp` is published for QUIC.

**Blossom servers:**
- Purpose: optional storage-backed encrypted transfers.
- Code: `public/scripts/blossom-transfer.js`, tests in `test/blossom-transfer-protocol.test.js` and `test/blossom-key-delivery.test.js`.
- Configuration: `BLOSSOM_SERVERS` is passed through `/config`; compose currently leaves it empty.
- Security: browser-side encrypted descriptors and hash validation are tested before fallback decrypt paths.

**STUN/TURN:**
- Purpose: WebRTC NAT traversal.
- Code: default RTC config in `server/index.js`; client use in `public/scripts/network.js`.
- Default STUN: `stun:stun.l.google.com:19302`.
- Custom config: `RTC_CONFIG` points at a JSON file such as `rtc_config_example.json`.
- Optional TURN compose support: `docker-compose-coturn.yml` and `turnserver_example.conf`.

## Data Storage

**Server-local files:**
- `server/federation.js` persists `meshdrop-server-id` and `meshdrop-nostr-secret` under `PLN_DIR` when env values are not supplied.
- FIPS configuration is mounted from `fips.yaml`.
- Pollen state is stored in the `pollen-data` Docker volume.

**Browser storage:**
- Persistent pairing and local preferences use browser storage through `public/scripts/persistent-storage.js`.
- Nostr identity is read from browser storage by `public/scripts/network.js`.
- The app is installable as a PWA and uses `public/service-worker.js` for caching.

**Databases:**
- No traditional database was found.
- State is in memory, local files, Docker volumes, and browser storage.

## Authentication & Identity

**Peer identity:**
- `server/peer.js` accepts valid UUID peer IDs when paired with a hash.
- Signed Nostr identity can replace generated peer IDs with a 64-character pubkey.

**Nostr identity:**
- `server/nostr-identity.js` validates identity event shape, kind, content, clock skew, display name, and signature.
- Browser identity changes force a server reconnect in `public/scripts/network.js`.

**Pairing:**
- Persistent device pairing uses high-entropy room secrets and short pair keys handled in `server/ws-server.js`.

## Monitoring & Observability

**Logs:**
- Plain `console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug`.
- Debug mode emits environment/config details in `server/index.js`; keep `DEBUG_MODE=false` for production privacy.

**Health/status endpoints:**
- `/config` exposes client runtime configuration.
- `/fips/status` checks FIPS control state.
- `/pollen/status` checks `pln` availability.
- `/.well-known/meshdrop-federation` exposes local federation snapshot.

**Error tracking:**
- No external error tracking service was found.

## CI/CD & Deployment

**Hosting:**
- Docker self-hosting through `Dockerfile` and compose files.
- Node direct start through `npm start` or `npm run start:prod`.

**CI Pipeline:**
- `.github/workflows/docker-image.yml` builds Docker image on pushes and pull requests to `master`.
- `.github/workflows/github-image.yml` builds and pushes GHCR images on version tags.
- `.github/workflows/zip-release.yml` packages `pairdrop-cli` on version tags.
- `.github/dependabot.yml` updates npm dependencies weekly.

## Environment Configuration

**Development:**
- Use `npm start` for local Node service.
- Use `docker-compose-dev.yml` or `docker-compose.yml` for container work.
- FIPS/Pollen runtime checks require host binaries and mounted runtime state.

**Production:**
- Configure published URL, relay list, RTC servers, rate limiting, and transport toggles through env vars.
- Docker compose currently configures the intended local service shape for Web UI, FIPS, Nostr, Blossom, and Pollen.

## Webhooks & Callbacks

**Incoming:**
- `POST /federation/events` receives remote federation events.
- `POST /pollen/upload` receives streamed uploads for Pollen-backed transfer.
- `POST /settings/fips/peers` writes FIPS peer connection settings.

**Outgoing:**
- `server/federation.js` posts events to remote `POST /federation/events` endpoints.
- `server/federation.js` connects to Nostr relays for Pollen federation discovery.
- `server/pollen-transfer.js` shells out to `pln` for seed/fetch/status operations.

---
*Integration audit: 2026-07-04*
*Update when adding/removing external services*
