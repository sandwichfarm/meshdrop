---
status: complete
date: 2026-07-06
---

# Hide Legacy Relay Header Toggle

Goal: make the Docker-served header testable for the operator by ensuring the visible protocol groups contain icon-only round controls in this order:

- Identity: Nostr
- Network: Instance, FIPS, Pollen
- Storage: Blossom, Hashtree

Keep Nostr relay discovery internals available, but remove the legacy Relay/WebRTC-looking switch from the visible header groups. Hidden Relay discovery must still autostart when Nostr identity, encryption, runtime config, and WebRTC support are ready, so removing the button does not remove the previous cross-instance WebRTC discovery path. Pollen must show a `0` badge when visible and no peer count is known. Do not add visible group titles or protocol words.

Validation:

- Focused header/action tests.
- Full `npm test`.
- Browser E2E smoke.
- Docker Compose proof on the operator target, `http://127.0.0.1:3000`.
- Nostr/WebRTC transfer proof after the Relay button is hidden.
- Docker browser proof that hidden Relay discovery is active without `meshdrop_nostr_mesh_enabled` being set.
- Playwright screenshot/DOM proof that buttons are 40x40, text is empty, the legacy relay anchor is not visible, and narrow viewports do not clip overflow.
- Changed-code AI-slop gate clean.
