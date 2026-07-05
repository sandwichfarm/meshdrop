# Bluetooth Transport Negotiation Plan

## Goal

Expose Bluetooth capability negotiation truthfully across server, SPA/static manifests, desktop, and mobile artifacts
without claiming Bluetooth file-transfer support.

## Scope

- Add focused regression coverage for Bluetooth capability metadata.
- Distinguish API/runtime availability from transport support.
- Preserve `supported: false` until a real Bluetooth transfer path exists.
- Keep physical-device UAT and Bluetooth transfer implementation out of this slice.

## Verification

- Focused runtime/static/package tests.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` with baseline reported if still failing.
