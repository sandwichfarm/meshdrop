---
status: complete
quick_id: 260706-android-native-core-tool-hooks
slug: android-native-core-tool-hooks
date: 2026-07-06
---

# Summary

Android native-source/APK packaging now accepts explicit per-ABI native tool paths for `fips`, `fipsctl`, and `pln`.
Generated Android code extracts packaged tools from `assets/meshdrop-native/<abi>/`, marks them executable in app-private
storage, and delegates installed backend calls to `fipsctl` or `pln` when those tools are present.

The fallback loopback object store remains in place and still reports `rustCore=false` / `pln=false` when Android native
core tools are absent.

# Evidence

- `node --check scripts/mobile-native-source.mjs`
- `node --check scripts/build-mobile-package.mjs`
- `node --test test/mobile-package.test.js`
- `node --test test/mobile-package.test.js test/uat-runbooks.test.js test/spa-runtime-config.test.js`
- `npm test`
- `npm run test:android-apk`
- `npm run test:android-release-apk`
- `MESHDROP_ANDROID_AVD='Medium_Phone_API_36.1' npm run test:android-fips-pollen`
- `MESHDROP_ANDROID_AVD='Medium_Phone_API_36.1' npm run test:android-webview-transfer`
- `git diff --check`
- `npx --yes aislop scan --changes .`

# Not Proven

- Android Rust FIPS binary/core execution inside installed APK. Local FIPS Android cross-check failed before source code
  because the active FIPS Rust toolchain lacks Android std components.
- Android Pollen WASM/pln execution inside installed APK. Local `pln` found during this task is an x86_64 Linux binary,
  not an Android binary.
