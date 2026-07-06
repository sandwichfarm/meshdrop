---
status: complete
date: 2026-07-06
---

# Nostr Label, Peer Grouping, And Crypto Gating

Goal: replace confusing user-facing `Relay` wording with `Nostr`, keep one visible peer bubble per Nostr pubkey when the same device is reachable through multiple discovery paths, and prevent users from selecting private payload encryption when Web Crypto is unavailable.

Validation:

- Focused protocol label/default privacy tests.
- Focused RTC peer manager alias tests.
- Full `npm test`.
- Browser transfer smoke.
- Docker smoke if runtime proof is needed.
- Diff check and AI-slop changed-code gate.
