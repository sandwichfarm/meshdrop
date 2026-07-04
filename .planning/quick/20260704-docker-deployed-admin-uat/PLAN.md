---
status: in_progress
created: 2026-07-04
slug: docker-deployed-admin-uat
---

# Docker Deployed Admin UAT

## Target

Close the Docker target ledger gap for real deployed-admin UAT without disturbing the already-running `meshdrop`
container on this host.

## Scope

- Add an isolated Docker Compose UAT command that inherits `docker-compose.yml`.
- Configure a temporary signed admin npub and npub discovery peer through compose environment.
- Override container name and host ports so the proof can run beside the live `meshdrop` container.
- Prove `/config`, FIPS/Pollen npub-network IDs, signed admin GUI visibility/rejection, backend signed admin settings,
  and browser file transfer against the compose-started deployment.
- Record proof in Docker UAT docs, target status, and GSD state.

## Out Of Scope

- WebKit transfer UAT.
- Start9/Umbrel device install UAT.
- Native/mobile targets.
- Changing the live `meshdrop` container.

## Validation

- Focused UAT guard test.
- Compose deployed-admin UAT command.
- `npm test`.
- `npm run test:docker`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` baseline report.
