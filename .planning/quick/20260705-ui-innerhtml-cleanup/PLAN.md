---
status: planned
created: 2026-07-05
task: Remove unsafe UI innerHTML security findings
---

# Remove unsafe UI innerHTML security findings

## Objective

Clear the `aislop` security errors in `public/scripts/ui.js` without changing user-visible QR code or received-text link behavior.

## Scope

- Replace QR SVG injection with a DOM parser/import path that rejects non-SVG roots.
- Replace received-text link HTML string assembly with text and anchor DOM nodes.
- Add focused regression tests for the QR and received-text helpers.

## Verification

- `node --test` focused tests for the new helpers.
- `npm test`.
- `git diff --check`.
- `npx --yes aislop scan --changes .`.
- `npx --yes aislop scan .` with remaining baseline findings reported if unrelated.
