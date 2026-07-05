---
status: active
quick_id: 260705-abw
slug: android-webview-bluetooth-negotiation
date: 2026-07-05
---

# Quick Task 260705-abw: Android WebView Bluetooth negotiation

## Goal

Prove the installed Android WebView runtime negotiates Bluetooth capability state without claiming Bluetooth file
transfer support, then remove the stale Android-specific "Bluetooth transport negotiation" remaining-proof label.

## Scope

- Extend Android WebView capability smoke to read actual `navigator.bluetooth` and negotiated
  `RuntimeCapabilities.bluetoothCapabilities()` from inside the installed APK.
- Keep `transports.bluetooth` and negotiated `transferSupported` false.
- Update Android APK/release APK proof metadata, UAT docs, target status, and CI workflow coverage.

## Red Proof

- `npm run test:android-apk` failed before implementation because Android APK metadata still listed
  `Bluetooth transport negotiation` as remaining proof.

## Verification Plan

- `node --check scripts/android-webview-capability-smoke.mjs`
- `npm run test:android-apk`
- `npm run test:android-release-apk`
- `node --test test/ci-workflow.test.js test/uat-runbooks.test.js test/mobile-package.test.js`
- `MESHDROP_ANDROID_AVD=Medium_Phone_API_36.1 npm run test:android-webview-capabilities`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
