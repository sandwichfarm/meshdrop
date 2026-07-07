---
status: complete
created: 2026-07-07T00:22:57Z
completed: 2026-07-07T00:39:00Z
---

# Add Clearnet Route Exclusion

Goal: keep automatic route selection, but let the user exclude clearnet/direct WebRTC routes the same way FIPS and Pollen can be excluded.

Scope:
- Treat clearnet exclusion as disabling direct `ip` and direct Nostr-signaled `nostr` RTC routes.
- Keep Nostr identity/follow-list use available for FIPS/Pollen discovery.
- When clearnet is disabled, existing active direct routes must move to the next allowed route by current priority, or disconnect if no route remains.
- Update user-facing copy so "Nostr" is not described as the transport.

Verification:
- Focused protocol tests for route filtering and fallback.
- Existing local discovery and header copy tests.
- Repo default gates before ship.
