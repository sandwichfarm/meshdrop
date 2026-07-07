# ADR 0008: Track Blocked Route Proofs In GitHub Issues

Date: 2026-07-07

Status: Accepted

## Context

MeshDrop has real byte-transfer proof for direct WebRTC, Blossom, Hashtree, Pollen storage, Pollen instance relay, FIPS stream, FIPS instance relay, Android native Pollen, and generic TURN relay-only WebRTC.

The remaining route-expansion work is not blocked by code shape alone. It needs external runtime surfaces:

- Tor/I2P/Loki need a reproducible local daemon or proxy dial path before transfer support can be claimed.
- FIPS/Pollen route-specific WebRTC needs a relay endpoint reachable through the named overlay, not only generic TURN proof.
- GHCR anonymous image readback needs package visibility or an explicit authenticated distribution contract.
- Deployed StartOS/Umbrel UAT needs real installed service URLs.
- Signed iOS device/share-transfer UAT needs macOS signing hardware and a real device.

## Decision

Blocked route and release/UAT claims must be tracked in live GitHub issues with acceptance criteria. GSD remains the local planning source, but it must link to the tracker for blockers that require external infrastructure or hardware.

Current blocker issues:

- Tor/I2P/Loki byte-transfer proof: https://github.com/sandwichfarm/meshdrop/issues/151
- FIPS/Pollen route-specific WebRTC relay proof: https://github.com/sandwichfarm/meshdrop/issues/152
- GHCR anonymous readback: https://github.com/sandwichfarm/meshdrop/issues/156
- Deployed StartOS/Umbrel UAT: https://github.com/sandwichfarm/meshdrop/issues/157
- Signed iOS device/share-transfer UAT: https://github.com/sandwichfarm/meshdrop/issues/158

Until each issue's acceptance proof exists, MeshDrop must keep the corresponding runtime claim fail-closed.

## Consequences

- Future route milestones can start from issue acceptance criteria instead of rediscovering blockers.
- UI/config labels must not imply support for blocked transports.
- PR bodies and GSD summaries should cite blocker issue URLs when deferring external proof.
- If an issue closes, the next milestone should update GSD state and add runtime proof before changing support labels.

## Verification

- GitHub issue tracker is enabled for `sandwichfarm/meshdrop`.
- Existing blocker issues #151 and #152 read back from GitHub.
- New blocker issues #156, #157, and #158 were created with acceptance criteria.
- Focused docs test requires all blocker issue links and rejects stale issue-disabled wording.
