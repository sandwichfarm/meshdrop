# Docker UAT Runbook

Use this runbook for the server-backed Docker target built from `Dockerfile` and configured by `docker-compose.yml`.

## Build

1. Run `npm ci`.
2. Run `npm run test:docker`.
3. Confirm the smoke builds `meshdrop:smoke`, starts a container, waits for `/config`, submits a signed admin GUI
   settings request, initiates browser file transfers, starts two Docker-served instances for relay transfer proof, and
   removes the containers after the run.

## Compose Configuration

For a shared-instance deployment, set these values in `docker-compose.yml` or an equivalent compose override:

- `MESHDROP_ADMIN_NPUB`: the npub or hex pubkey allowed to sign server-side settings changes.
- `NOSTR_RELAYS`: relay list for Nostr WebRTC signaling and announcements.
- `FIPS_DISCOVERY=true`: enables the FIPS backend path.
- `POLLEN_TRANSFER=true`: enables the Pollen backend path.
- `BLOSSOM_SERVERS`: optional comma-separated Blossom servers.

Do not configure static discovery npub lists or static room IDs for FIPS/Pollen discovery. Browser clients derive
trusted peer rooms at runtime from the logged-in Nostr identity's kind 3 follow list after loading NIP-65 relays from
bootstrap relays.
Do not bind-mount host `fips` or `fipsctl` binaries. The Docker image installs both tools under `/usr/local/bin`; compose
only needs the `fips.yaml` config mount, `/dev/net/tun`, `NET_ADMIN`, FIPS/Pollen ports, and data volumes.

## Runtime Acceptance

1. Start the service with compose:

   ```sh
   docker compose up --build
   ```

2. Open the Web UI from another browser on the same LAN.
3. Confirm `/config` reports:
   - `capabilities.runtime.target` as `standalone`.
   - `capabilities.runtime.hasBackend` as `true`.
   - FIPS and Pollen transport capabilities as supported when enabled.
   - `admin.enabled` as `true` only when `MESHDROP_ADMIN_NPUB` is configured.
4. Confirm the FIPS and Pollen configured rooms are empty unless explicit public discovery is enabled.
5. Use the configured admin identity to submit a signed settings change from the GUI.
6. Confirm the same settings controls are hidden or rejected for a non-admin identity.
7. Transfer a small file between two peers over every enabled transport that claims WebRTC support.

## Automated Smoke

Run:

```sh
npm run test:docker
```

The smoke proves container boot, `/config`, runtime capability metadata, runtime Nostr WOT discovery room derivation,
installed `fips`/`fipsctl` binaries, signed-admin capability exposure, a signed admin GUI FIPS peer save against a
container-local FIPS control mock, Pollen local status, federation metadata, served browser assets, local WebRTC
transfer, Pollen mesh transfer between two browser peers loaded from one container, and Nostr WebRTC transfer between
browser peers loaded from two separate Docker containers through a deterministic relay.

To run only the two-container relay proof:

```sh
npm run test:docker:two-host
```

Passing output must include `Proof docker-two-host-nostr-webrtc: nostr delivered meshdrop-proof-icon.svg between two Docker instances`.

To prove the compose deployment path with a configured shared-instance admin npub, run:

```sh
npm run test:docker:admin
```

This UAT inherits `docker-compose.yml`, overrides the container name and fixed ports so it can run beside an existing
deployment, injects a temporary `MESHDROP_ADMIN_NPUB`, starts the service with compose, checks `/config`, confirms
FIPS/Pollen do not expose static discovery rooms by default, drives the signed admin GUI request, confirms a
non-admin signer cannot see or submit server settings, and initiates local plus Pollen browser transfers.

Passing output must include `Proof docker-deployed-admin-settings: compose admin`.

## Public Relay UAT

The default two-host smoke uses an in-process relay so CI remains deterministic. To prove the same Docker-served
two-host path against public Nostr infrastructure, run:

```sh
MESHDROP_DOCKER_PUBLIC_RELAY_URLS=wss://bucket.coracle.social npm run test:docker:two-host
```

Passing output must include `Proof docker-public-relay-two-host-webrtc: nostr delivered meshdrop-proof-icon.svg between two Docker instances`.
The public relay path retries up to three transfer attempts by default because it depends on external relay delivery;
set `MESHDROP_DOCKER_PUBLIC_RELAY_ATTEMPTS` to override that UAT retry count.

For GitHub-hosted proof, dispatch the `CI` workflow manually with `docker_public_relay_urls` set to one or more relay
URLs. The manual-only `Docker public relay UAT` job installs Chromium, builds the Docker image, starts two containers,
and does not run on normal PR or push events.

Current GitHub-hosted proof: manual run `28715209725` on `agent/docker-public-relay-receive-20260704` passed the
Docker public relay UAT job against `wss://bucket.coracle.social`. The first public relay attempt timed out waiting for
an open RTC peer; the second attempt emitted the required public proof line.

## Current Proof

- `npm run test:docker:admin` passed locally on 2026-07-04 in branch
  `agent/docker-deployed-admin-uat-20260704`, proving the isolated compose deployed-admin path without disturbing the
  already-running `meshdrop` container.

## Not proven

- Run `npm run test:e2e` for the broader source-served transfer matrix outside Docker.
