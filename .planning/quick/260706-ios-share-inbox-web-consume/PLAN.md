---
status: in_progress
created: 2026-07-06
branch: agent/ios-share-inbox-web-consume-20260706
---

# iOS share inbox web consumption

## Goal

Connect the generated iOS `meshdropShareInbox` bridge to the existing MeshDrop web share-mode flow so staged App Group files can become normal outbound share-mode files.

## Constraints

- Do not claim physical iOS device UAT.
- Reuse existing `activate-share-mode` behavior.
- Add no dependencies.
- Keep native share inbox reads source-testable.

## Plan

1. Add a focused regression test for reading native inbox entries into `File` objects and firing `activate-share-mode`.
2. Implement the smallest web-side consumer for `globalThis.meshdropShareInbox`.
3. Update mobile UAT/status docs to distinguish source-level web consumption from device UAT.
4. Run focused test, full tests, diff check, and AI-slop gates.
