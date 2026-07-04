# Technology Stack

**Analysis Date:** 2026-07-04

## Languages

**Primary:**
- JavaScript ES modules - all server code in `server/*.js`, browser code in `public/scripts/*.js`, and tests in `test/*.test.js`.
- HTML/CSS - static PWA shell in `public/index.html`, `public/styles/styles-main.css`, and `public/styles/styles-deferred.css`.

**Secondary:**
- Shell - helper launch assets in `pairdrop-cli/` and startup wrapper `scripts/start-with-fips.sh`.
- YAML - Docker Compose and GitHub Actions configuration in `docker-compose*.yml` and `.github/workflows/*.yml`.

## Runtime

**Environment:**
- Node.js >=15 from `package.json` `engines.node`.
- Browser runtime for the static PWA assets served from `public/`.
- Docker runtime for self-hosted service deployment via `Dockerfile` and `docker-compose.yml`.

**Package Manager:**
- npm - `package-lock.json` is present.
- `.npmrc` is present; use npm commands from `package.json`.

## Frameworks

**Core:**
- Express 4.22.2 - HTTP server, static file serving, JSON API routes in `server/server.js`.
- ws 8.21.0 - WebSocket signaling server in `server/ws-server.js`.
- WebRTC browser APIs - primary peer-to-peer transfer path in `public/scripts/network.js`.
- Progressive Web App APIs - service worker and install flow in `public/service-worker.js` and `public/scripts/main.js`.

**Testing:**
- Node built-in test runner - `npm test` runs `node --test`.
- Custom smoke runners - `npm run test:e2e` runs `scripts/e2e-smoke.mjs`; `npm run test:docker` runs `scripts/docker-smoke.mjs`.

**Build/Dev:**
- No bundler. Browser scripts are loaded directly by `public/scripts/main.js`.
- Service worker cache/version update is done with `npm run build:service-worker`.
- Docker image builds from `Dockerfile`; compose variants live in `docker-compose.yml`, `docker-compose-dev.yml`, and `docker-compose-coturn.yml`.

## Key Dependencies

**Critical:**
- `express` 4.22.2 - HTTP API and static asset serving.
- `ws` 8.21.0 - WebSocket server and relay clients.
- `nostr-tools` 2.23.8 - Nostr identity verification and federation event signing.
- `express-rate-limit` ^7.1.5 - optional HTTP rate limiting when `RATE_LIMIT` is enabled.
- `ua-parser-js` ^1.0.37 - peer device naming in `server/peer.js`.
- `unique-names-generator` ^4.3.0 - deterministic fallback display names.

**Browser libraries:**
- `zip.min.js` - multiple-file archive downloads.
- `no-sleep.min.js` - keeps the display awake during transfers.
- `heic2any.min.js` - HEIC/HEIF conversion.
- `qr-code.min.js` - pairing and room QR code flows.

## Configuration

**Environment:**
- Runtime configuration is environment-variable driven in `server/index.js`.
- Important env vars include `PORT`, `WS_FALLBACK`, `RATE_LIMIT`, `RTC_CONFIG`, `SIGNALING_SERVER`, `NOSTR_RELAYS`, `NOSTR_ROOM`, `BLOSSOM_SERVERS`, `FIPS_DISCOVERY`, `FIPS_CONTROL_SOCKET`, `FIPS_ROOM`, `POLLEN_TRANSFER`, `PLN_BIN`, `PLN_DIR`, `POLLEN_PORT`, `MESHDROP_FEDERATION`, and `MESHDROP_FEDERATION_PUBLIC_URL`.
- Docker compose currently publishes the Web UI on `3000/tcp`, FIPS UDP on `2121/udp`, FIPS TCP on `8443/tcp`, and Pollen QUIC on `60611/udp`.

**Build:**
- `package.json` scripts are the source of truth for test and build commands.
- No TypeScript, Babel, Vite, Webpack, or ESLint configuration was found.
- GitHub Actions build Docker images from `.github/workflows/docker-image.yml` and `.github/workflows/github-image.yml`.

## Platform Requirements

**Development:**
- Node.js and npm.
- Docker for compose and container smoke tests.
- Optional local binaries for full multi-network behavior: `fips`, `fipsctl`, and `pln`.

**Production:**
- Node process or Docker container.
- Modern browser clients with WebRTC support for the primary file transfer path.
- Optional STUN/TURN configuration through `RTC_CONFIG`.
- Optional multi-network transports through FIPS, Pollen, Nostr relays, and Blossom servers.

---
*Stack analysis: 2026-07-04*
*Update after major dependency, runtime, or deployment changes*
