# Quick Task: External UAT Finish-Line Verifier

## Target

Add one fail-loud command that audits the remaining external finish-line proofs without pretending this session can
complete hardware, deployed-node, or GHCR visibility work.

## Scope

- Add `npm run test:external-uat -- v0.x.y`.
- Reuse existing Start9, Umbrel, iOS signed-device, and anonymous GHCR harnesses.
- Keep Android physical-device UAT out of the blocker list because current target-status evidence records it as passed.
- Update UAT docs/tests so future release checks point at the consolidated command.

## Verification

- `node --test test/external-uat-finishline.test.js test/uat-runbooks.test.js`
- `npm run test:external-uat -- v0.1.5` should fail closed until the external inputs and GHCR public readback are real.
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`
