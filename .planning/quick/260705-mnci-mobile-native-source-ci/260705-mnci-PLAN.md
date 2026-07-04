---
status: complete
quick_id: 260705-mnci
slug: mobile-native-source-ci
---

# Quick Task 260705-mnci: Mobile Native Source CI

## Goal

Add PR CI coverage for the actual iOS and Android native-source artifact CLI scripts, so package-script regressions are
caught before merge.

## Scope

1. Add a CI job that runs after unit tests.
2. Run `npm run build:ios:native-source` and `npm run build:android:native-source` into `/tmp`.
3. Read back each tarball for the expected native wrapper source and bundled app asset paths.
4. Update the CI workflow guard test.
5. Record GSD state after validation.

## Validation

- `node --test test/ci-workflow.test.js`
- Native-source build/tar readback command copied from CI.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
