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

### Active

- [ ] Docker shared-instance admin npub is configured in compose/runtime config.
- [ ] Admin-only GUI controls are visible only for the configured admin identity.
- [ ] Backend validates admin setting changes with signed Nostr events from the configured admin npub.
- [ ] FIPS/backend settings can be managed through the signed admin path.
- [ ] CI/CT/CD workflows exercise the right gates without redundant release reruns.
- [ ] Multi-platform build/run/UAT paths are documented and verified.

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
| Docker shared-instance admin is scoped to configured npub | Shared instances need server-side settings without exposing controls to every user | — Pending |

---
*Last updated: 2026-07-04 after initializing GSD project state from the goal objective.*
