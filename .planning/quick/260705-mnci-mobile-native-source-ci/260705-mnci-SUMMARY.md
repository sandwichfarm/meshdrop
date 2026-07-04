---
status: complete
quick_id: 260705-mnci
slug: mobile-native-source-ci
completed: 2026-07-05
---

# Summary

PR CI now runs the actual iOS and Android native-source artifact package scripts after unit tests and reads back each
tarball for the expected wrapper source plus bundled app assets.

This closes the gap where builder unit tests covered exported functions but not the package script/CLI path.

## Evidence

- `node --test test/ci-workflow.test.js`
- Local copy of the CI shell:
  - `npm run build:ios:native-source -- --version 0.0.0-ci --out-dir "${out_dir}"`
  - `npm run build:android:native-source -- --version 0.0.0-ci --out-dir "${out_dir}"`
  - Tar readback for iOS `MeshDropViewController.swift` and `Resources/meshdrop/index.html`.
  - Tar readback for Android `AndroidManifest.xml`, `MainActivity.java`, and `assets/meshdrop/index.html`.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`

## Remaining Risk

- `actionlint` is not installed on this host, so workflow syntax awaits GitHub Actions parsing.
- Native APK/IPA builds and device transfer UAT remain open.
