---
status: in_progress
quick_id: 260706-android-rust-fips-core-proof
slug: android-rust-fips-core-proof
date: 2026-07-06
---

# Quick Task 260706: Android Rust FIPS Core Proof

## Goal

Replace the remaining `rustCore=false` Android FIPS gap with installed-APK proof that packaged Android `fips` and
`fipsctl` binaries start inside the app and serve `/fips/status` through the Rust-backed control socket.

## Scope

1. Fix the upstream FIPS Android cross-build blockers needed for `fips` and `fipsctl` binaries.
2. Build Android x86_64 `fips` and `fipsctl` binaries locally.
3. Package those binaries into the generated MeshDrop Android APK through `MESHDROP_ANDROID_FIPS_*` env hooks.
4. Run the installed Android FIPS/Pollen smoke with packaged FIPS and `pln`.
5. Update MeshDrop docs/PR/GSD only if runtime proof succeeds.

## Constraints

- Keep MeshDrop WebView UI and loopback backend shape unchanged.
- Do not claim FIPS complete until installed APK proof reports the Rust-backed `android-native-fipsctl` path.
- FIPS Android source changes live in separate task worktree `/home/sandwich/Develop/fips-android-core-20260706`.

## Verification Plan

- FIPS Android cross-build for `fips` and `fipsctl`.
- MeshDrop Android APK build with `MESHDROP_ANDROID_FIPS_X86_64`, `MESHDROP_ANDROID_FIPSCTL_X86_64`, and
  `MESHDROP_ANDROID_PLN_X86_64`.
- Installed Android smoke with FIPS status available through `android-native-fipsctl` and Pollen round trip through
  `android-native-pln`.
- Focused MeshDrop tests and repo gates after docs/test updates.
