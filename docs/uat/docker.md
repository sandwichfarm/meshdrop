# Docker UAT Runbook

Use this runbook for the server-backed Docker target built from `Dockerfile` and configured by `docker-compose.yml`.

## Build

1. Run `npm ci`.
2. Run `npm run test:docker`.
3. Confirm the smoke builds `meshdrop:smoke`, starts a container, waits for `/config`, and removes the container after the run.

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
signed-admin capability exposure, Pollen local status, federation metadata, and served browser assets.

## Not proven

- The Docker smoke does not prove a two-host public-relay deployment.
- The Docker smoke does not initiate browser file transfers; run `npm run test:e2e` for local transfer proof.
- Real shared-instance admin UAT still needs a manual signed GUI request using the deployment admin npub.
