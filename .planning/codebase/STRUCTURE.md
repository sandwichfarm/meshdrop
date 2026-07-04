# Codebase Structure

**Analysis Date:** 2026-07-04

## Directory Layout

```text
meshdrop/
|-- .github/              # Dependabot, issue templates, Docker/release workflows
|-- dev/                  # Development Docker assets
|-- docs/                 # User/self-hosting docs and screenshots
|-- licenses/             # Third-party browser library licenses
|-- nips/                 # MeshDrop NIP-style protocol notes
|-- pairdrop-cli/         # Desktop/CLI integration scripts
|-- public/               # Browser PWA assets, scripts, styles, localization, service worker
|-- scripts/              # Build and smoke-test helpers
|-- server/               # Node HTTP, WebSocket, federation, and transport adapters
|-- test/                 # Node test runner suites
|-- Dockerfile            # Container image
|-- docker-compose.yml    # Main local service compose
|-- fips.yaml             # FIPS daemon config mounted by compose
|-- package.json          # npm scripts and dependencies
`-- README.md             # Upstream PairDrop-oriented user docs
```

## Directory Purposes

**server/:**
- Purpose: Node runtime and server-side protocol/control code.
- Contains: ES module JavaScript classes and adapters.
- Key files: `server/index.js`, `server/server.js`, `server/ws-server.js`, `server/peer.js`, `server/federation.js`, `server/fips-control.js`, `server/pollen-transfer.js`, `server/nostr-identity.js`.
- Subdirectories: none.

**public/:**
- Purpose: Browser app and static assets.
- Contains: `index.html`, PWA manifest, service worker, scripts, styles, sounds, fonts, images, localization JSON.
- Key files: `public/scripts/main.js`, `public/scripts/network.js`, `public/scripts/ui.js`, `public/scripts/blossom-transfer.js`, `public/scripts/hashtree-transfer.js`, `public/scripts/pollen-transfer.js`, `public/scripts/fips-discovery.js`, `public/service-worker.js`.
- Subdirectories: `public/scripts/libs/`, `public/scripts/worker/`, `public/styles/`, `public/lang/`, `public/images/`, `public/fonts/`, `public/sounds/`.

**test/:**
- Purpose: Node test runner suites for protocol and server behavior.
- Contains: `*.test.js` files.
- Key files: `test/ws-room.test.js`, `test/federation-server.test.js`, `test/fips-control.test.js`, `test/pollen-transfer-server.test.js`, `test/blossom-transfer-protocol.test.js`, `test/service-worker-version.test.js`.
- Subdirectories: none.

**scripts/:**
- Purpose: executable helper scripts for versioning and smoke tests.
- Contains: `scripts/set-service-worker-version.mjs`, `scripts/e2e-smoke.mjs`, `scripts/docker-smoke.mjs`, `scripts/start-with-fips.sh`.

**docs/:**
- Purpose: user and self-hosting documentation inherited from PairDrop plus screenshots.
- Contains: markdown docs and media assets.
- Key files: `docs/host-your-own.md`, `docs/how-to.md`, `docs/technical-documentation.md`, `docs/docker-swarm-usage.md`, `docs/faq.md`.

**nips/:**
- Purpose: protocol notes for MeshDrop extensions.
- Contains: `nips/meshdrop-device-pairing.md`, `nips/meshdrop-transfer-rooms.md`.

**pairdrop-cli/:**
- Purpose: desktop shell/CLI integrations.
- Contains: shell, Windows shortcut/script, and config example.

**.github/:**
- Purpose: repository automation and templates.
- Contains: Dependabot config, issue templates, and Docker/release workflows.

## Key File Locations

**Entry Points:**
- `server/index.js`: Node service startup and runtime configuration.
- `public/scripts/main.js`: browser app bootstrap.
- `public/index.html`: served app shell.

**Configuration:**
- `package.json`: npm scripts, dependencies, Node engine.
- `package-lock.json`: npm lockfile.
- `Dockerfile`: container build.
- `docker-compose.yml`: main local service shape and published ports.
- `docker-compose-dev.yml`: development compose.
- `docker-compose-coturn.yml`: optional TURN setup.
- `fips.yaml`: FIPS config mounted into container.
- `rtc_config_example.json`: sample RTC/STUN/TURN config.

**Core Logic:**
- `server/ws-server.js`: room membership, signaling, pairing, keepalive, federation hooks.
- `server/peer.js`: peer identity, device naming, IP grouping, rate limiting.
- `server/server.js`: HTTP routes and static serving.
- `server/federation.js`: remote discovery and federation event bridge.
- `server/fips-control.js`: FIPS control socket adapter.
- `server/pollen-transfer.js`: Pollen upload/download adapter.
- `public/scripts/network.js`: browser WebSocket connection and signaling.

**Testing:**
- `test/*.test.js`: all Node test suites.
- `scripts/e2e-smoke.mjs`: e2e smoke runner.
- `scripts/docker-smoke.mjs`: Docker smoke runner.

**Documentation:**
- `README.md`: current top-level docs, still mostly PairDrop-branded.
- `AGENTS.md`: required repository agent contract.
- `.planning/codebase/*.md`: GSD codebase map.

## Naming Conventions

**Files:**
- `kebab-case.js` for most server and browser modules, for example `server/fips-control.js` and `public/scripts/nostr-mesh.js`.
- `*.test.js` for test files under `test/`.
- Uppercase root docs for project-level docs: `README.md`, `CONTRIBUTING.md`, `LICENSE`, `AGENTS.md`.

**Directories:**
- Lowercase descriptive names.
- Plural collection directories: `scripts/`, `styles/`, `images/`, `licenses/`, `docs/`.

**Special Patterns:**
- Server adapters live in `server/*-control.js`, `server/*-transfer.js`, or transport-specific modules.
- Browser protocol implementations live in `public/scripts/*-transfer.js`, `public/scripts/*-discovery.js`, and `public/scripts/*-mesh.js`.
- Protocol tests use names such as `*-protocol.test.js`; server adapter tests use names such as `*-server.test.js` or module-specific names.

## Where to Add New Code

**New server feature:**
- Primary code: `server/`.
- Tests: `test/{feature}.test.js`.
- HTTP route: add to `server/server.js`.
- WebSocket message: add switch case and handler in `server/ws-server.js`.

**New browser transfer/discovery protocol:**
- Primary code: `public/scripts/{protocol}.js`.
- Load order: update `public/scripts/main.js` deferred script list if it must load at runtime.
- UI integration: `public/scripts/ui.js` and `public/scripts/ui-main.js`.
- Tests: `test/{protocol}-protocol.test.js` or a focused test file.

**New transport adapter:**
- Server adapter: `server/{transport}-*.js`.
- Config wiring: `server/index.js` and `/config` response in `server/server.js`.
- Federation wiring: `server/federation.js` if the transport discovers or bridges remote peers.
- Browser script: `public/scripts/{transport}-*.js` if users interact with it.

**New deployment/config behavior:**
- Compose: `docker-compose.yml` or variant compose file.
- Container build: `Dockerfile`.
- Smoke proof: `scripts/docker-smoke.mjs`.
- Docs: `docs/host-your-own.md` or a MeshDrop-specific planning doc.

**Utilities:**
- Server helpers: `server/helper.js`.
- Browser utilities: `public/scripts/util.js`.

## Special Directories

**node_modules/:**
- Purpose: installed npm dependencies.
- Source: `npm install`.
- Committed: no.

**.omx/:**
- Purpose: oh-my-codex runtime state.
- Source: agent/runtime tooling.
- Committed: no.

**.planning/:**
- Purpose: GSD project state, codebase map, requirements, roadmap, and phase artifacts.
- Source: GSD workflows.
- Committed: yes for this workflow unless config later sets planning docs local-only.

**public/scripts/libs/:**
- Purpose: vendored browser libraries used without bundling.
- Source: committed third-party minified assets.
- Committed: yes, with licenses under `licenses/`.

---
*Structure analysis: 2026-07-04*
*Update when directory structure changes*
