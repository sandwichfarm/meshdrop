---
status: in-progress
quick_id: 260705-ryy
slug: ios-bluetooth-negotiation
date: 2026-07-05
---

# iOS Bluetooth Negotiation

## Goal

Remove the iOS Bluetooth negotiation gap by making generated iOS native-source artifacts explicitly negotiate Bluetooth
as unsupported instead of leaving it as ambiguous remaining proof.

## Scope

- Add iOS native-source Bluetooth capability metadata with transfer support disabled.
- Remove Bluetooth negotiation from iOS native-source and Simulator app remaining-proof lists.
- Update UAT docs, target-status, and tests.
- Do not claim Bluetooth transfer support, signed iOS packages, App Group provisioning, device picker UAT, share-sheet
  UAT, or native iOS transfer UAT.

## Verification

- Focused mobile package tests.
- UAT runbook tests.
- Repo test gate.
- Diff and AI-slop gates.
