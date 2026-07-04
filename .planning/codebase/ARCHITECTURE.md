# Architecture

**Analysis Date:** 2026-07-04

## Pattern Overview

**Overall:** Browser-first file-sharing PWA with a Node signaling/control server.

**Key Characteristics:**
- Static browser app served by Express.
- WebSocket signaling for discovery, room membership, and WebRTC negotiation.
- Direct browser-to-browser transfer is preferred; WebSocket fallback and storage-backed transfer paths are optional.
- Multi-network discovery is layered through local IP rooms, persistent secret rooms, public rooms, FIPS, Pollen, Nostr, and Blossom.
- Runtime state is mostly in-memory on the server and browser-side in local storage.

## Layers

**Browser UI layer:**
- Purpose: render simple transfer UX, pairing controls, room controls, status badges, install flow, and localization.
- Contains: `public/index.html`, `public/scripts/main.js`, `public/scripts/ui-main.js`, `public/scripts/ui.js`, `public/styles/*.css`, `public/lang/*.json`.
- Depends on: browser APIs, deferred scripts, `/config`, WebSocket server.
- Used by: end users in modern browsers.

**Browser protocol layer:**
- Purpose: transfer files/text and negotiate rooms/transports.
- Contains: `public/scripts/network.js`, `public/scripts/local-discovery.js`, `public/scripts/nostr-mesh.js`, `public/scripts/fips-discovery.js`, `public/scripts/pollen-transfer.js`, `public/scripts/blossom-transfer.js`, `public/scripts/hashtree-transfer.js`.
- Depends on: WebSocket messages, WebRTC, Web Crypto, fetch, storage APIs.
- Used by: UI layer and service worker runtime.

**HTTP layer:**
- Purpose: serve assets, expose config/status, accept storage-backed upload/download, and expose federation endpoints.
- Contains: `server/server.js`.
- Depends on: Express, configured clients from `server/index.js`.
- Used by: browser clients and remote MeshDrop federation servers.

**WebSocket signaling layer:**
- Purpose: manage peers, rooms, pairing, keepalive, signaling, fallback relay, and federated peer projection.
- Contains: `server/ws-server.js` and `server/peer.js`.
- Depends on: `ws`, peer metadata, `MeshFederation`.
- Used by: browser `ServerConnection` and remote federation flow.

**Transport adapter layer:**
- Purpose: encapsulate external transport/control systems.
- Contains: `server/fips-control.js`, `server/pollen-transfer.js`, `server/nostr-identity.js`.
- Depends on: FIPS control socket, `pln`, Nostr signatures, Node streams.
- Used by: HTTP routes, federation, and WebSocket room joins.

**Federation layer:**
- Purpose: discover remote MeshDrop servers over FIPS/Pollen/Nostr and bridge remote peers into local signaling rooms.
- Contains: `server/federation.js`.
- Depends on: FIPS status/events, Pollen `pln` service commands, Nostr relay sockets, HTTP federation endpoints, WebSocket server hooks.
- Used by: `server/index.js` and `PairDropWsServer`.

## Data Flow

**Browser startup:**
1. `server/server.js` serves `public/index.html`.
2. `public/scripts/main.js` initializes localization, UI, service worker, and deferred scripts.
3. `public/scripts/network.js` fetches `/config`.
4. Browser opens WebSocket with peer ID, WebRTC capability, and optional Nostr identity.
5. `server/ws-server.js` sends `ws-config` and `display-name`.
6. Client joins room types based on UI/config/discovery.

**Local peer transfer:**
1. Client sends `join-ip-room`, `room-secrets`, `join-public-room`, or similar message.
2. `PairDropWsServer` adds the peer to an in-memory room in `this._rooms`.
3. Existing peers receive `peer-joined`; joining peer receives `peers`.
4. Browser peers exchange `signal` messages through `PairDropWsServer`.
5. Data moves over WebRTC when available; WebSocket fallback can relay transfer messages when enabled.

**FIPS room flow:**
1. Client sends `join-fips-room`.
2. `PairDropWsServer` calls `FipsControlClient.status()`.
3. If FIPS is available, peer joins the configured FIPS room.
4. `MeshFederation` discovers FIPS peers and hydrates remote peers into the same room.

**Pollen storage transfer:**
1. Browser uploads to `POST /pollen/upload`.
2. `PollenTransferClient.uploadStream()` streams request body into `pln seed -`.
3. Server returns descriptor with hash, size, and type.
4. Browser or peer downloads through `GET /pollen/download/:hash`.
5. `PollenTransferClient.fetchToTemp()` fetches the hash to a temp file and cleans it after response.

**Federation event flow:**
1. Local peers join FIPS or Pollen rooms.
2. `MeshFederation.localPeerJoined()` broadcasts peer events to remote servers for matching transport.
3. Remote events arrive at `POST /federation/events` or via discovered HTTP snapshots.
4. `MeshFederation._dispatchEvent()` calls WebSocket server federation hooks.
5. `PairDropWsServer` projects remote peers into local rooms and relays signals back through federation.

**State Management:**
- Server rooms, pair keys, keepalive timers, remote servers, relay sockets, and seen relay events are in memory.
- Server identity and Nostr secret can persist in files under `PLN_DIR`.
- Browser pairing, settings, and Nostr identity live in browser storage.
- No database migration or durable server room store exists.

## Key Abstractions

**Peer:**
- Purpose: normalized client identity, IP grouping, device name, WebRTC capability, Nostr identity, and rate limiting.
- Location: `server/peer.js`.
- Pattern: class instantiated per WebSocket connection.

**PairDropWsServer:**
- Purpose: central room registry and signaling router.
- Location: `server/ws-server.js`.
- Pattern: stateful WebSocket server object.

**PairDropServer:**
- Purpose: Express app and HTTP server.
- Location: `server/server.js`.
- Pattern: thin server wrapper with route setup in constructor.

**FipsControlClient:**
- Purpose: translate HTTP/server intent to FIPS control socket commands.
- Location: `server/fips-control.js`.
- Pattern: adapter around TCP/Unix socket JSON line protocol.

**PollenTransferClient:**
- Purpose: translate HTTP upload/download/status to `pln` child-process commands.
- Location: `server/pollen-transfer.js`.
- Pattern: adapter around child processes and Node streams.

**MeshFederation:**
- Purpose: discover remote servers, publish local peers, and bridge federated signals.
- Location: `server/federation.js`.
- Pattern: stateful coordinator with polling, relay sockets, and transport-specific discovery.

## Entry Points

**Server startup:**
- Location: `server/index.js`.
- Triggers: `npm start`, `npm run start:prod`, Docker command.
- Responsibilities: build config from env/argv, validate constraints, instantiate HTTP/WebSocket/federation services.

**HTTP server:**
- Location: `server/server.js`.
- Triggers: browser HTTP requests and remote federation requests.
- Responsibilities: serve static app, config, FIPS/Pollen status, federation, Pollen upload/download.

**WebSocket server:**
- Location: `server/ws-server.js`.
- Triggers: browser WebSocket connections.
- Responsibilities: room membership, signaling, pairing, keepalive, remote federation peer projection.

**Browser app:**
- Location: `public/scripts/main.js`.
- Triggers: page load.
- Responsibilities: initialize UI, localization, service worker, deferred protocol scripts, URL param handling.

## Error Handling

**Strategy:** fail softly for optional transports, fail fast for invalid boot config, and return 502 for storage/control route failures.

**Patterns:**
- Boot config validation in `server/index.js` uses `console.error()` and `process.exit(1)` for invalid `SIGNALING_SERVER` and IPv6 localization settings.
- Optional transport status methods return `{available: false, error}` instead of throwing to callers.
- HTTP Pollen/FIPS mutation routes catch adapter errors and return `502` JSON.
- Federation polling catches and logs transport errors so one bad peer or relay does not stop the server.
- WebSocket malformed JSON is ignored with a warning.

## Cross-Cutting Concerns

**Logging:**
- Plain console logging throughout server and browser code.
- `DEBUG_MODE` enables extra server-side environment and peer IP output; do not enable in production without privacy review.

**Validation:**
- Peer IDs are UUIDs or 64-character hex Nostr pubkeys.
- Room secrets must be ASCII 64-256 characters.
- FIPS peer settings are normalized and capped at 32 peers.
- Pollen hashes must be 64 hex characters.
- Nostr identities are signature and clock-skew checked in `server/nostr-identity.js`.

**Authentication:**
- No account auth.
- Pairing uses shared room secrets.
- Optional Nostr identity verifies a signed event and can become the peer ID.

**Privacy/security:**
- WebRTC is preferred for direct transfer.
- Storage-backed transfers need descriptor/hash/encryption checks in browser code and tests.
- Debug logs may expose environment and peer connection details.

---
*Architecture analysis: 2026-07-04*
*Update when major patterns change*
