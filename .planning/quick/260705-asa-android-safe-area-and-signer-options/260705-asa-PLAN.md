---
status: complete
quick_id: 260705-asa
slug: android-safe-area-and-signer-options
date: 2026-07-05
---

# Quick Task 260705-asa: Android safe area and signer options

## Goal

Make the Android/WebView UI usable at the top system bar, keep Nostr login reachable without NIP-07, and expose Android signer launch when Amber/NIP-55 is installed.

## Plan

1. Add regression coverage for Nostr login visibility and generated Android signer/network manifest metadata.
2. Add viewport/safe-area CSS for Android system bars.
3. Keep the Nostr identity control visible, route login through a chooser when multiple methods exist, and add a native Android signer path through NIP-55 intents.
4. Keep backend-required protocol controls honest: WebRTC/Nostr remain available on Android; LAN/FIPS/Pollen show when runtime config says supported, not when the static APK has no backend.
5. Verify focused tests, Android build/runtime proof where possible, repo gates, AI-slop, commit, push, and PR readback.
