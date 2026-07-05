---
status: complete
completed: 2026-07-05
slug: desktop-chromium-binary-proof
---

# Summary

Desktop Chromium artifacts now include a compiled Linux launcher binary.

## Changed

- Added `packaging/desktop/meshdrop-desktop-chromium.c`.
- The desktop package builder compiles `bin/meshdrop-desktop-chromium` and still packages `bin/meshdrop-desktop-chromium.mjs`.
- Chromium shell manifests now point `nativeShell.executable` at the binary and record the script path separately.
- Chromium smokes start the packaged server through the binary wrapper.
- Desktop runbook and UAT target ledger now describe the binary proof and keep signed installer proof open.

## Evidence

- Red proof: `node --test test/desktop-package.test.js` failed because Chromium artifacts lacked `bin/meshdrop-desktop-chromium`.
- Green proof: `node --test test/desktop-package.test.js test/uat-runbooks.test.js` passed 5/5.
- Runtime proof: `npm run test:desktop-chromium` passed and transferred `meshdrop-desktop-chromium-proof.txt` through the binary launcher.
- Runtime proof: `npm run test:desktop-chromium-bundled` passed and transferred `meshdrop-desktop-chromium-proof.txt` through the binary launcher using bundled `bin/chromium/chrome`.
- Dependency proof: `npm ci` passed with 0 vulnerabilities.
- Repo proof: `npm test` passed 196/196.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean.
- `npx --yes aislop scan .` still fails on the known repo baseline: 417 `no-undef` lint errors, 3 direct `innerHTML` security errors, 42 console warnings, plus duplicate/size/long-function warnings.

## Remaining Risk

- Signed installer proof remains open.
- Full-repo AI-slop baseline remains failing outside this Desktop binary slice.
