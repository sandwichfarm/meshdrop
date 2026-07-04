# Backend-free SPA transfer proof summary

## Result

`npm run test:spa-artifact` now builds the SPA tarball, serves the unpacked artifact from a static HTTP server, opens two
backend-free browser contexts, connects deterministic Nostr identities through a test relay, waits for WebRTC peer
connection, and transfers `meshdrop-spa-proof.txt`.

## Evidence

- Static red/green guard: `node --test test/spa-artifact.test.js`.
- Runtime proof: `PLAYWRIGHT_MODULE_PATH= PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:spa-artifact`.
- Runtime log: `Proof backend-free-spa-nostr-webrtc: nostr delivered meshdrop-spa-proof.txt`.

## Remaining Gaps

- Public relay UAT across independently hosted SPA peers.
- Browser matrix UAT outside local Chromium.
