---
status: complete
created: 2026-07-05
slug: runtime-gui-capability-gates
---

# Quick Task: Runtime GUI Capability Gates

## Goal

Make Nostr-dependent GUI controls follow negotiated runtime capabilities instead of showing or enabling controls for
unsupported transports.

## Scope

- Gate Nostr mesh discovery on negotiated `nostr` and `webrtc` capabilities.
- Gate Blossom transfer mode on negotiated `blossom` capability.
- Gate Hashtree transfer mode on negotiated `hashtree` capability.
- Add regression coverage that hidden controls also refuse activation when the runtime reports unsupported transports.

## Out Of Scope

- Implementing new transports.
- Changing server-side capability negotiation.
- Adding runtime UAT beyond the GUI/controller capability contract.

## Validation

- Focused action-visibility regression.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
