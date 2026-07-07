# MeshDrop

## What This Is

MeshDrop is a privacy-first file sharing app for moving files between trusted people through as many real network conditions as possible. It uses Nostr as the authenticated identity and control plane for trust, presence, signaling, and private route negotiation, then selects among plural data planes to move encrypted bytes.

The product model is: pick a person, let MeshDrop find a path, transfer the file, verify the hash, and fail honestly when no path works. The current implementation is still rooted in a PairDrop-style browser client plus Node/Express server, with target runtimes across standalone/Docker instances, SPA artifacts, Start9/Umbrel, desktop, iOS, and Android.

## Core Value

Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

Nostr is the control plane, not the only data path. MeshDrop should discover trusted peers and negotiate private route descriptors through Nostr, then use the best available route adapter: direct WebRTC, local WebSocket fallback, Blossom, Hashtree, Pollen, FIPS, instance relay, TURN, Tor, I2P, Loki, or future transports.

Proof beats labels. A toggle, badge, route descriptor, status response, or discovered peer is not enough. A claimed route is real only after transfer proof shows file bytes crossed that route and the receiver verified them.

## Current Milestone: v0.4.0 Route Attempts UX

**Goal:** make route selection legible to users by showing route choices, attempt states, failure reasons, privacy labels, and proof-backed completion without exposing protocol internals.

**Target features:**
- Show route candidates and selected route attempts for each peer in a compact, scan-friendly surface.
- Show clear unavailable or failed reasons such as needs Nostr sign-in, requires instance, requires native app, overlay unavailable, peer route expired, and fallback blocked.
- Label privacy and data path honestly: end-to-end encrypted, direct, relayed by instance, backend-only, or public discovery enabled.
- Keep unsupported routes hidden or disabled until runtime status and transfer primitives prove they can carry bytes.

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

- [x] Introduce a generic route adapter contract that answers: runtime availability, safe descriptor shape, data-plane behavior, encrypted send/receive primitive, and transfer proof.
- [ ] Fit FIPS into that adapter contract with a first-class data-plane path that transfers encrypted file bytes over FIPS and reports proof.
- [x] Fit Pollen into that adapter contract with descriptor, upload/download or service substrate behavior, proof, and fail-closed fallback rules.
- [x] Turn instance federation from discovery/signaling bridges into an encrypted file relay path under the same adapter contract.
- [ ] Show route attempts, choices, unavailable states, and privacy labels in the UI using proof-backed route status instead of optimistic transport badges.
- [ ] Implement WebRTC overlay relay candidates for FIPS and Pollen, or explicitly ship a differently named non-WebRTC live-transfer fallback where browser ICE cannot be constrained. Requirements: `docs/webrtc-overlay-transport-requirements.md`.
- [x] Keep current FIPS/Pollen room descriptors working while the generic contract is introduced; Slice 1 must not rewrite live route selection.
- [ ] Make `ghcr.io/sandwichfarm/meshdrop` publicly readable, or otherwise prove anonymous GHCR manifest readback for the next `v0.*.*` release tag.
- [ ] Run deployed StartOS and Umbrel node UAT with `npm run test:start9-deployed` and `npm run test:umbrel-deployed` against real installed services.
- [ ] Run the signed iOS device-install harness on macOS hardware, then complete iOS device file-picker/share-sheet/native
  transfer UAT.

### Out of Scope

- Static room namespaces for FIPS/Pollen discovery — explicitly rejected; discovery must be npub-network based.
- Backwards compatibility with alpha-era room env vars — alpha allows clean breaks.
- Claiming WebRTC works from unit tests alone — runtime transfer proof is required.
- Treating Nostr as the data plane — Nostr carries identity, trust, presence, signaling, and route negotiation.
- Collapsing user npubs, FIPS npubs, and Pollen service identities — transport identities are separate and may only be linked through short-lived session route descriptors.
- Port scanning overlay networks — use explicit configured peers, runtime status, route descriptors, control APIs, and authenticated peer responses.
- Marking backend-only transports as available in SPA/source artifacts — capability metadata must match the runtime.
- Treating mobile UI exposure as native transport support — native support requires backend/runtime primitives and transfer proof.

## Context

- Nostr identity is optional for quick unauthenticated transfers, but central for authenticated use. Authenticated flows should load follows, derive trusted peer sets, sign events, encrypt signaling, and use relay/bootstrap settings without falling back to untrusted route negotiation.
- Transport identities are distinct from user identities. User npubs represent people and sessions; FIPS npubs represent FIPS routing identities; Pollen service identities represent Pollen routing/service state.
- The browser client currently owns UI, peer list, route selection, WebRTC setup, and file transfer flow. The Node/Express server serves the app, owns WebSocket signaling, exposes runtime config, and can provide backend transport endpoints.
- Current discovery/signaling surfaces include local instance rooms, secret/public rooms, Nostr mesh presence and encrypted WebRTC signaling, FIPS/Pollen pairwise route rooms derived from Nostr identities, and server federation over FIPS/Pollen HTTP descriptors.
- Current transfer paths include direct WebRTC data channel transfer, local WebSocket fallback, Blossom encrypted object transfer, Hashtree object transfer, and Pollen upload/download descriptor transfer through backend endpoints.
- FIPS currently has status/config surfaces, a control client, browser capability gating, route descriptors, server-side peer discovery, and HTTP federation candidate handling. The missing part is first-class encrypted byte transfer over FIPS with proof.
- Pollen currently appears as both a browser-facing transfer endpoint and a server/native `pln` substrate where available. It needs the same descriptor, send/receive, proof, and fallback shape as other route adapters.
- Instance federation can track peers, expose snapshots, receive remote peer/signaling events, discover HTTP federation endpoints, and bridge Pollen services/FIPS-reachable base URLs. It still needs to become an encrypted file relay path instead of only a discovery bridge.
- Runtime capability negotiation is baseline, not optional. SPA can use browser-available routes; it cannot claim backend-only FIPS/Pollen unless the host/browser can reach those networks directly or the transfer uses a reachable instance/object-store path.
- Docker shared instance is multi-user and needs server-side admin control through a configured npub. SPA, native, and mobile are single-user contexts and should not inherit shared-instance admin assumptions.
- Existing `.planning/codebase/` maps architecture, stack, testing, and integrations.

## Constraints

- **Verification**: WebRTC is only proven after initiating a transfer between two peers.
- **Verification**: Transfer support means encrypted file bytes moved over the claimed route and the receiver verified them.
- **Privacy**: Private routes use encrypted, short-lived descriptors; unsupported routes fail closed instead of silently downgrading.
- **Security**: Shared-instance admin requests must be backend-validated with signed Nostr events from the configured admin npub.
- **Identity**: Do not bind FIPS npubs to user npubs; bind them only through short-lived session route descriptors.
- **Discovery**: Do not port scan overlay networks.
- **Architecture**: Feature availability must be negotiated from runtime capabilities.
- **Architecture**: FIPS, Pollen, Tor, I2P, Loki, TURN, instance relay, and future routes should be adapters, not separate product architectures.
- **Release**: Alpha `v0.x.y`; clean breaks are acceptable and compatibility shims are not required.
- **Workflow**: Work must be tracked through GSD state, committed, pushed, and opened as PRs from task branches.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Nostr is the control plane | It carries identity, social graph trust, presence, signaling, and private route negotiation without becoming the only data path | ✓ Good |
| Data planes are plural route adapters | Real networks require direct, relayed, object-store, overlay, native-only, and instance-mediated paths | — Pending |
| Transport identities stay separate from user identities | FIPS and Pollen identities represent routing/service state, not the human user | — Pending |
| Npub-network discovery replaces FIPS/Pollen room envs | Static rooms do not represent the user’s intended peer network | ✓ Good |
| Runtime transfer proof is required for WebRTC claims | Prior “fixed” claims failed without transfer proof | ✓ Good |
| Discovery/signaling is not byte transport proof | FIPS/Pollen can currently discover and signal peers while browser ICE still carries bytes over direct candidates | Active relay requirement |
| Route labels require byte-path proof | Visible controls and descriptors are not proof unless the route carried verified file bytes | ✓ Good |
| Docker shared-instance admin is scoped to configured npub | Shared instances need server-side settings without exposing controls to every user | ✓ Good |
| Pollen instance relay is the first backend relay slice | Existing Pollen upload/download primitives give the shortest path to prove encrypted bytes through an instance-mediated backend route before FIPS stream work | ✓ Good |
| Route attempts need user-facing explanations | Users need to understand why a route is selected, unavailable, failed, or complete without reading protocol internals | Active UX requirement |

---
*Last updated: 2026-07-07 after starting milestone v0.4.0 Route Attempts UX.*
