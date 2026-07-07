# Clearnet Route Control Visibility Summary

Status: complete

## Result

The Clearnet control now represents file-route exclusion, not Nostr discovery. It remains visible when direct Nostr-signaled WebRTC is available even if same-instance local discovery is unsupported, and it hides only when no Clearnet file-route class is supported.

Footer badges now separate same-instance Clearnet discovery from Nostr discovery/signaling. FIPS and Pollen copy now states the current truth: they can discover and signal WebRTC peers, but browser WebRTC bytes still follow ICE unless a real relay-only FIPS/Pollen candidate exists.

The actual "WebRTC over FIPS/Pollen" requirement is now tracked in `docs/webrtc-overlay-transport-requirements.md` and `.planning/PROJECT.md`. The requirement is explicit: FIPS/Pollen only count as WebRTC byte transports when the selected ICE candidate pair is constrained to a FIPS- or Pollen-backed relay/candidate.

## Evidence

- `npm test -- test/local-discovery-protocol.test.js test/action-visibility.test.js test/peer-availability-protocol.test.js test/header-copy.test.js test/footer-discovery-protocol.test.js`
- `npm test` - 287/287 pass
- `npm run test:e2e` - browser transfer smoke passed; federated Pollen proof now logs discovery/signaling separately from browser ICE data path
- `git diff --check` - clean
- `npx --yes aislop scan --changes .` - exits 0; AI-slop, security, linting clean; code-quality warnings are pre-existing large-file/duplicate/long-function findings in touched legacy files
- `npx --yes aislop scan .` - exits 1 on existing full-repo baseline warnings outside this fix: noble-ciphers unused expressions/TODOs/empty function body, large files, duplicate blocks, and `server/nostr-identity.js` hardcoded URL

## Remaining Gap

Forcing file bytes over FIPS or Pollen is not implemented by this change. That requires adding a relay-only WebRTC candidate path or equivalent FIPS/Pollen data relay, then proving ICE cannot select direct Clearnet candidates when the user excludes Clearnet.
