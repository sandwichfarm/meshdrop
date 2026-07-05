---
status: complete
completed: 2026-07-05
slug: ci-runtime-change-gates
---

# Summary

CI now classifies changed paths before expensive runtime jobs.

## Changed

- Added a `ci-change-scope` job to emit a `runtime` output.
- Gated browser, SPA matrix, target artifact, Desktop Chromium, mobile native-source, Android APK/emulator/release APK, and Docker smoke jobs on that output.
- Kept manual dispatches classified as runtime so explicit UAT runs still execute the heavyweight jobs.
- Added workflow regression assertions for classifier coverage and gated jobs.

## Evidence

- Red proof: `node --test test/ci-workflow.test.js` failed because `ci-change-scope` was absent and runtime jobs still needed only `unit`.
- Green proof so far: `node --test test/ci-workflow.test.js` passed 8/8.
- Dependency proof: `npm ci` passed with 0 vulnerabilities.
- Workflow syntax proof: Ruby YAML parse passed for `.github/workflows/docker-image.yml`.
- Workflow lint proof: `go run github.com/rhysd/actionlint/cmd/actionlint@latest .github/workflows/docker-image.yml` passed.
- Repo proof: `npm test` passed 196/196 after `npm ci`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean; it reported 0 changed code files because this slice changes workflow, tests, and planning metadata.
- `npx --yes aislop scan .` still fails on the known repo baseline: 417 `no-undef` lint errors, 3 direct `innerHTML` security errors, 42 console warnings, plus duplicate/size/long-function warnings.

## Remaining Risk

- Full-repo AI-slop baseline remains failing outside this workflow-only slice.
