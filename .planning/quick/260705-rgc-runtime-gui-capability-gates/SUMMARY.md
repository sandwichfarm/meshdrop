---
status: complete
completed: 2026-07-05
slug: runtime-gui-capability-gates
---

# Summary

Nostr-dependent controls now follow negotiated runtime capabilities. Unsupported runtimes hide and refuse activation
for Nostr mesh discovery, Blossom transfers, and Hashtree transfers instead of exposing controls that cannot work.

## Changed

- Added runtime capability helpers for Nostr mesh, Blossom transfer, and Hashtree transfer controllers.
- Hid unsupported Nostr-dependent buttons and disabled active/persisted selections when config changes make them unsupported.
- Added localized fallback notifications for unsupported Nostr mesh, Blossom, and Hashtree modes.
- Added regression coverage for unsupported negotiated capabilities.

## Evidence

- Red proof: `node --test test/action-visibility.test.js` failed before implementation because unsupported Nostr
  capabilities still attempted relay connection and hit missing `WebSocket`.
- Focused regression passed: `node --test test/action-visibility.test.js` 19/19.
- Repo tests passed: `npm test` 193/193.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` exited 0 with no lint, security, or AI-slop findings; inherited file-size
  warnings remain for the edited legacy scripts.
- `npx --yes aislop scan .` still fails on the known repo baseline: 417 `no-undef` lint errors, 3 direct `innerHTML`
  security errors, 42 console warnings, duplicate/size/long-function warnings, and vendor TODO/stub warnings.

## Remaining Risk

- This is controller/GUI capability gating only. It does not add new runtime transfer UAT or new transport support.
