---
status: complete
created: 2026-07-04
slug: bluetooth-capability-gate
---

# Quick Task: Bluetooth Capability Gate

## Goal

Make Bluetooth support explicit in runtime capability negotiation and keep it unsupported until a real Bluetooth
transport exists and is transfer-tested.

## Scope

- Add capability tests that require `transports.bluetooth.supported === false`.
- Add server `/config` and static runtime capability metadata for Bluetooth.
- Ensure desktop and mobile target manifests continue to avoid claiming Bluetooth transfer support.
- Update UAT/status docs only if needed to avoid overclaiming.

## Out Of Scope

- Implementing a Bluetooth transfer protocol.
- Adding native shell/toolchain dependencies.
- Building app-store/mobile packages.
- Physical-device Bluetooth UAT.

## Validation

- Focused runtime, SPA config, desktop, and mobile package tests.
- `npm test`.
- `git diff --check`.
- AI-slop scans.
