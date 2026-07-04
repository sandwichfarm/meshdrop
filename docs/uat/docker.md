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
- `MESHDROP_DISCOVERY_NPUBS`: comma-separated npubs or hex pubkeys used for FIPS/Pollen federation discovery.
- `NOSTR_RELAYS`: relay list for Nostr WebRTC signaling and announcements.
- `FIPS_DISCOVERY=true`: enables the FIPS backend path.
- `POLLEN_TRANSFER=true`: enables the Pollen backend path.
- `BLOSSOM_SERVERS`: optional comma-separated Blossom servers.

Do not use `NOSTR_ROOM` or `FIPS_ROOM` for FIPS/Pollen federation UAT. Those paths are expected to use npub-network discovery.

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
4. Confirm the FIPS and Pollen network IDs begin with `npub-network:` when discovery peers are configured.
5. Use the configured admin identity to submit a signed settings change from the GUI.
6. Confirm the same settings controls are hidden or rejected for a non-admin identity.
7. Transfer a small file between two peers over every enabled transport that claims WebRTC support.

## Automated Smoke

Run:

```sh
npm run test:docker
```

The smoke proves container boot, `/config`, runtime capability metadata, FIPS/Pollen npub-network discovery IDs,
signed-admin capability exposure, a signed admin GUI FIPS peer save against a container-local FIPS control mock, Pollen
local status, federation metadata, served browser assets, local WebRTC transfer, Pollen mesh transfer between two
browser peers loaded from one container, and Nostr WebRTC transfer between browser peers loaded from two separate Docker
containers through a deterministic relay.

To run only the two-container relay proof:

```sh
npm run test:docker:two-host
```

Passing output must include `Proof docker-two-host-nostr-webrtc: nostr delivered meshdrop-proof-icon.svg between two Docker instances`.

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

## Not proven

- The Docker smoke proves two Docker-served hosts through a deterministic relay, not a public relay deployment.
- The Docker smoke proves local WebRTC, Pollen mesh, and deterministic two-host Nostr WebRTC transfers; run
  `npm run test:e2e` for the broader source-served transfer matrix.
- Real shared-instance admin UAT still needs a manual signed GUI request using the deployment admin npub and deployment
  FIPS control plane.
