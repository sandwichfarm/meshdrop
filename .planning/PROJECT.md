# MeshDrop

## What This Is

MeshDrop is a multi-transport file sharing system where each instance can mesh with other instances and use whatever transports are available to share files. The current starting surface is the Docker image, but the target platform set also includes SPA-only, Start9/Umbrel, desktop native, and mobile runtimes.

## Core Value

Files must transfer between peers reliably over every negotiated transport that claims to support the path. The product target is signaling and WebRTC over every useful topology when that is what the user's network conditions require, without hiding hard relay requirements behind optimistic labels.

For MeshDrop, "WebRTC over FIPS/Pollen" means more than discovery or SDP exchange through those networks. It means the selected WebRTC ICE candidate path carries file bytes through a FIPS- or Pollen-backed relay/candidate. Until that relay exists, FIPS and Pollen must be described as discovery/signaling routes with browser ICE data paths, not as forced byte transports.

## Requirements

### Validated

- ✓ Nostr WebRTC discovery uses followed npub contacts instead of static rooms.
- ✓ FIPS and Pollen federation discovery derive their network from npub contacts instead of static rooms.
- ✓ Browser e2e smoke proves local, FIPS, Pollen, Nostr, and federated FIPS transfer paths in the current Docker/local test harness.
- ✓ Claimed Docker, SPA, Desktop Chromium, Android WebView, and target-artifact WebRTC paths have deterministic transfer proof with path-specific payloads.
- ✓ Runtime capability negotiation gates GUI controls by target/runtime capability instead of hard-coded transport assumptions.
- ✓ Docker shared-instance admin controls are gated by configured admin npub and backend-verified signed Nostr events.
- ✓ Alpha release automation builds/readbacks target artifacts and GHCR images with authenticated GitHub Actions package access.
- ✓ Alpha `v0.1.5` publishes the latest Android, Desktop Chromium bundled installer, iOS app, Start9, Umbrel, SPA, desktop, and Node artifacts.

### Active

- [ ] Implement WebRTC overlay relay candidates for FIPS and Pollen, or explicitly ship a differently named non-WebRTC live-transfer fallback where browser ICE cannot be constrained. Requirements: `docs/webrtc-overlay-transport-requirements.md`.
- [ ] Make `ghcr.io/sandwichfarm/meshdrop` publicly readable, or otherwise prove anonymous GHCR manifest readback for the next `v0.*.*` release tag.
- [ ] Run deployed StartOS and Umbrel node UAT with `npm run test:start9-deployed` and `npm run test:umbrel-deployed` against real installed services.
- [ ] Run the signed iOS device-install harness on macOS hardware, then complete iOS device file-picker/share-sheet/native
  transfer UAT.

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
| Discovery/signaling is not byte transport proof | FIPS/Pollen can currently discover and signal peers while browser ICE still carries bytes over direct candidates | Active relay requirement |
| Docker shared-instance admin is scoped to configured npub | Shared instances need server-side settings without exposing controls to every user | ✓ Good |

---
*Last updated: 2026-07-06 after adding the signed iOS device-install harness.*
