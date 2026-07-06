---
status: complete
date: 2026-07-06
---

# Summary

Renamed the Nostr discovery route from `Relay` / `Nostr relay` to `Nostr` in user-facing peer badges and transfer options while keeping relay-specific wording only in technical details.

Peer grouping now normalizes Nostr pubkey aliases and preserves `nostrIdentity` metadata on local/FIPS/Pollen RTC peers, so route aliases can resolve to one visible peer identity instead of separate bubbles when the same npub is known.

Private payload encryption now defaults to `Unencrypted` and disables the `Private` option when Web Crypto is unavailable, instead of allowing selection and failing after send.

Relay settings now render again by using the exported relay settings preference object, and the Relays tab defaults Inbox/Outbox fields from the signed-in identity's discovered NIP-65 read/write relays when no local override exists.

Crypto clarification: WebRTC data channels are transport-encrypted by the browser's WebRTC stack. MeshDrop's `Private` option is additional application-layer file encryption before bytes leave the browser, and that extra layer requires Web Crypto on the sender.

Evidence:

- `node --test test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js` passed, 29/29.
- `node --test test/nostr-mesh-protocol.test.js test/nostr-discovery-protocol.test.js` passed, 20/20.
- `npm test` passed, 253/253.
- `npm run test:e2e` passed, including local, Blossom, Hashtree, FIPS, Pollen, Nostr, federated FIPS, and federated Pollen browser transfer proof.
- `npm run test:docker` passed, including Docker local WebRTC, Docker Pollen WebRTC, and two-host Nostr WebRTC transfer proof.
- `npm run build:service-worker` passed; generated cache stamp was restored before commit.
- `git diff --check` passed.
- Browser proof against Docker-served `http://127.0.0.1:3000` passed: one same-npub proof peer rendered as one bubble with `INSTANCE` + `NOSTR`, no `RELAY`, and the transfer dialog disabled `Private` while selecting `Unencrypted` when Web Crypto was unavailable.
- Browser proof against Docker-served `http://127.0.0.1:3000` passed for Settings > Relays: fields prefilled from current identity NIP-65 read/write relays, save persisted edits to localStorage, and save generated/published kind-10002 `read`/`write` relay tags.

Known gaps:

- `npx --yes aislop scan --changes .` exits 0 on the relay-settings follow-up with 0 AI-slop/security/lint issues and style/code-quality warnings only.
- `npx --yes aislop scan .` exits 1 on existing full-repo baseline warnings: noble library lint/TODOs, file-size/function-size warnings, duplicate blocks, and `server/nostr-identity.js` hardcoded URL warning.
