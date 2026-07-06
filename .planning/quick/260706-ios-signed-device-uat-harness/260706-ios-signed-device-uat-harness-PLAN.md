---
status: complete
quick_id: 260706-ios
slug: ios-signed-device-uat-harness
date: 2026-07-06
---

# Quick Task 260706-ios: iOS Signed Device UAT Harness

## Goal

Add a fail-loud signed iOS device-install harness so the remaining iOS proof gap has an executable command instead of
manual prose.

## Scope

1. Require macOS, Xcode signing inputs, and a physical iOS device UDID before any signed iOS proof can be claimed.
2. Build the generated Xcode project for a specific device with signing enabled.
3. Inspect signed App Group entitlements and install the app through `devicectl`.
4. Keep file-picker, share-sheet, native transfer, App Store, and TestFlight claims explicitly open.

## Validation

- Focused unit tests cover non-macOS rejection, missing signing/device env rejection, and signed `xcodebuild` argument
  generation.
- Full signed-device proof still requires a macOS host with a trusted physical iOS device.
