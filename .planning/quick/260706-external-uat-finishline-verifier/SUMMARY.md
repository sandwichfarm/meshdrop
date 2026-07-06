# Quick Task Summary: External UAT Finish-Line Verifier

## Result

Added `npm run test:external-uat -- v0.x.y` as the consolidated fail-loud verifier for the remaining external finish
line: Start9 deployed UAT, Umbrel deployed UAT, iOS signed physical-device UAT, and anonymous GHCR release readback.

## Evidence

- `node --test test/external-uat-finishline.test.js test/uat-runbooks.test.js` passed 5/5.
- `npm run test:external-uat -- v0.1.5` failed closed as expected on missing Start9/Umbrel/iOS inputs and GHCR
  `unauthorized`.
- `npm ci` installed dependencies in the task worktree.
- `npm test` passed 235/235.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still reports pre-existing full-repo baseline warnings outside this change.

## Known Gaps

- Start9 deployed-device UAT still requires a real StartOS install URL.
- Umbrel deployed-node UAT still requires a real Umbrel install URL.
- iOS signed physical-device UAT still requires macOS, Xcode signing, and a physical iOS device.
- Anonymous GHCR readback still requires public package visibility or a release policy change.
