---
status: complete
quick_id: 260706-android-fips-pollen-options
slug: android-fips-pollen-options
date: 2026-07-06
---

# Quick Task 260706: Android FIPS/Pollen Options

## Goal

Make Android APK runtime metadata expose FIPS and Pollen options when the native Android build can negotiate them, without falsely claiming a MeshDrop backend or daemon is already available.

## Plan

1. Add regression expectations for Android APK target metadata and WebView runtime capability visibility.
2. Change Android APK target manifest/static config so FIPS and Pollen are supported/enabled from Android APK metadata.
3. Verify focused package/runtime tests, Android APK build smoke, broad tests, diff/slop gates, then commit/push/open a stacked PR.
