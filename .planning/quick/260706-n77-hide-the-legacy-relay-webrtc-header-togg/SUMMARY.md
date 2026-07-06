---
status: complete
date: 2026-07-06
---

# Summary

Removed the visible Relay/WebRTC-style header toggle from the Network group, leaving a non-visual legacy `#nostr-mesh` anchor outside the header for existing controller and E2E assumptions. Restored icon-only round protocol buttons, removed visible group titles/protocol words, and allowed wrapped protocol controls to remain visible instead of clipping behind the expand control. Pollen now shows a `0` badge whenever the supported control is visible and no peer count is known.

Regression fix: hidden Relay/Nostr discovery now autostarts when identity, NIP-04 encryption, runtime config, and WebRTC support are ready. The autostart does not persist the old `meshdrop_nostr_mesh_enabled` toggle, and it republishes startup presence after connect so a second instance that subscribes slightly later can still discover the peer. Nostr identity hydration also preserves stored follow pubkeys when relay contact-list lookup is missing, because clearing those recipients made hidden Relay presence publish to nobody.

Evidence:

- `node --test test/header-copy.test.js test/action-visibility.test.js` passed, 31/31 before the Relay autostart regression fix; focused autostart tests are now covered by full `npm test`.
- `npm test` passed, 248/248.
- `npm run test:e2e` passed; listed transfer proofs include `Proof nostr-webrtc: direct delivered meshdrop-proof-icon.svg`, `Proof fips-webrtc`, `Proof pollen-webrtc`, and federated FIPS/Pollen transfer.
- `npm run test:docker` passed; listed transfer proofs include `Proof docker-local-webrtc`, `Proof docker-pollen-webrtc`, and `Proof docker-two-host-nostr-webrtc: nostr delivered meshdrop-docker-two-host-nostr-webrtc-proof.txt between two Docker instances`.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` passed clean, 100/100.
- `npm run build:service-worker` passed and confirmed the new autostart script is cache-listed.
- Docker proof on the operator target: `MESH_DROP_COMMIT=362c9b7-ui-round-buttons-localhost-3000c docker compose -p meshdrop -f docker-compose.yml up --build -d --force-recreate` built image digest `sha256:dc94c0b1dd1323b9d7b23dd3f0d4c74aea1299ff028f181b2447fe5abea8ceec`, served cache version `v1.11.2-362c9b7-ui-round-buttons-localhost-3000c-2026-07-06T15-32-58.547Z`, and left container `meshdrop` running healthy on `http://127.0.0.1:3000`.
- Regression Docker proof on the operator target: `MESH_DROP_COMMIT=relay-autostart-followlist-uat-20260706 docker compose up --build -d --force-recreate` built image digest `sha256:f281aabe43ef83085383a6bac9c770214724f9fa2cd0da8b289aad597d1a19c7`, served cache version `v1.11.2-relay-autostart-followlist-uat-20260706-2026-07-06T16-42-23.580Z`, and left container `meshdrop` running on `http://localhost:3000`.
- Playwright runtime proof on `http://localhost:3000` with a stored Nostr identity and no `meshdrop_nostr_mesh_enabled` preference showed `meshdropNostrMesh._active === true`, hidden `#nostr-mesh` with `display: none`, observed WebSocket connections to `wss://bucket.coracle.social`, visible header protocols `nostr-identity`, `local-discovery`, `fips-discovery`, `pollen-transfer`, `blossom-transfer`, `hashtree-transfer`, `protocol-settings`, and no header overflow. Screenshot: `/tmp/meshdrop-localhost3000-hidden-relay-followlist-autostart.png`.
- Playwright DOM proof on `http://127.0.0.1:3000` showed `labelNodes: 0`; all visible protocol buttons had empty text and `40x40` rects; Network ids were `local-discovery`, `fips-discovery`, `pollen-transfer`; Storage ids were `blossom-transfer`, `hashtree-transfer`; `pollen-transfer` badge was `0`; `nostr-mesh` was outside the header with `display: none`; narrow viewport header had `clientHeight == scrollHeight`.
- Screenshots: `/tmp/meshdrop-localhost3000-round-dark-desktop-final.png` and `/tmp/meshdrop-localhost3000-round-dark-narrow-final.png`.

Known gap:

- Full-repo `npx --yes aislop scan .` still fails on pre-existing baseline warnings outside touched files: noble-ciphers unused expressions, duplicate code blocks, large files, long functions, hardcoded URL, TODO/info findings.
