# MeshDrop

## What This Is

MeshDrop is a multi-transport file sharing system where each instance can mesh with other instances and use whatever transports are available to share files. The current starting surface is the Docker image, but the target platform set also includes SPA-only, Start9/Umbrel, desktop native, and mobile runtimes.

## Core Value

Files must transfer between peers reliably over every negotiated transport that claims to support the path.

## Requirements

### Validated

- ✓ Nostr WebRTC discovery uses followed npub contacts instead of static rooms.
- ✓ FIPS and Pollen federation discovery derive their network from npub contacts instead of static rooms.
- ✓ Browser e2e smoke proves local, FIPS, Pollen, Nostr, and federated FIPS transfer paths in the current Docker/local test harness.
- ✓ Claimed Docker, SPA, Desktop Chromium, Android WebView, and target-artifact WebRTC paths have deterministic transfer proof with path-specific payloads.
- ✓ Runtime capability negotiation gates GUI controls by target/runtime capability instead of hard-coded transport assumptions.
- ✓ Docker shared-instance admin controls are gated by configured admin npub and backend-verified signed Nostr events.
- ✓ Alpha release automation builds/readbacks target artifacts and GHCR images with authenticated GitHub Actions package access.

### Active

- [ ] Make `ghcr.io/sandwichfarm/meshdrop` publicly readable, or otherwise prove anonymous GHCR manifest readback for the next `v0.*.*` release tag.
- [ ] Cut and verify a new alpha release from current `master` so latest Android, Desktop Chromium bundled installer, iOS Simulator/device app, and Android release APK artifacts are present in the published release.
- [ ] Run physical Android hardware UAT with `npm run test:android-physical-device`.
- [ ] Run deployed StartOS and Umbrel node UAT with `npm run test:start9-deployed` and `npm run test:umbrel-deployed` against real installed services.
- [ ] Obtain signed/device-installable iOS package proof and iOS device file-picker/share-sheet/native transfer UAT.

### Out of Scope

- Static room namespaces for FIPS/Pollen discovery — explicitly rejected; discovery must be npub-network based.
- Backwards compatibility with alpha-era room env vars — alpha allows clean breaks.
- Claiming WebRTC works from unit tests alone — runtime transfer proof is required.

## Context

- User prefers GUI controls and toggles.
- Runtime capability negotiation is baseline, not an optional feature.
- Docker shared instance is multi-user and needs server-side admin control through a configured npub.
- SPA, native, and mobile are single-user contexts and should not inherit shared-instance admin assumptions.
- Existing `.planning/codebase/` maps architecture, stack, testing, and integrations.

## Constraints

- **Verification**: WebRTC is only proven after initiating a transfer between two peers.
- **Security**: Shared-instance admin requests must be backend-validated with signed Nostr events from the configured admin npub.
- **Architecture**: Feature availability must be negotiated from runtime capabilities.
- **Release**: Alpha `v0.x.y`; clean breaks are acceptable and compatibility shims are not required.
- **Workflow**: Work must be tracked through GSD state, committed, pushed, and opened as PRs from task branches.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Npub-network discovery replaces FIPS/Pollen room envs | Static rooms do not represent the user’s intended peer network | ✓ Good |
| Runtime transfer proof is required for WebRTC claims | Prior “fixed” claims failed without transfer proof | ✓ Good |
| Docker shared-instance admin is scoped to configured npub | Shared instances need server-side settings without exposing controls to every user | ✓ Good |

---
*Last updated: 2026-07-06 after auditing merged PRs #1-#105 and current release/GHCR evidence.*
