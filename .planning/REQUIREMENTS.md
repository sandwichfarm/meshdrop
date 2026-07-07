# Requirements: MeshDrop v0.7.0 FIPS Stream Route Proof

**Defined:** 2026-07-07
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

- Nostr WebRTC, local WebRTC, Blossom, Hashtree, Pollen storage, and Pollen instance-relay paths have automated transfer proof in the appropriate runtime targets.
- Runtime capability negotiation gates GUI controls by the current target's capabilities.
- Route descriptor validation, adapter vocabulary, scoring reasons, route attempts, and proof-backed completion copy exist.
- Backend-free SPA artifacts fail closed for backend-only FIPS/Pollen/native route claims while keeping pure-client Nostr WebRTC available.
- Installed Android APKs already expose a loopback native backend for FIPS status and Pollen upload/download.
- Pollen instance relay already proves encrypted payload bytes through an object-store primitive and emits route proof.

## v0.7.0 Requirements

### FIPS Stream Transfer

- [x] **FIPS-STREAM-01**: MeshDrop exposes `/fips/upload` and `/fips/download/:id` only when FIPS is enabled, available, and reports a mesh IPv6 address; uploads are size-limited, token-bound, and short-lived.
- [x] **FIPS-STREAM-02**: The browser FIPS stream protocol builds a v1 route descriptor with route type `fips`, transport shape `stream`, primitive `fips-http-stream`, owner/session bindings, expiry, FIPS mesh base URL, and encrypted/private/fail-closed constraints.
- [x] **FIPS-STREAM-03**: Private FIPS stream transfer uploads ciphertext to the sender instance, sends only descriptor/proof metadata through the control channel, fetches ciphertext from the recipient over the sender's FIPS mesh address, decrypts locally, verifies SHA-256 against the original payload, and emits route proof.
- [x] **FIPS-STREAM-04**: FIPS stream proof rejects missing runtime IDs, bad owner/session binding, expired descriptors, non-FIPS base URLs, byte mismatches, hash mismatches, and fallback flags.

### Runtime Proof

- [x] **FIPS-STREAM-05**: A Docker runtime smoke starts two real FIPS daemons, connects them as peers, uploads bytes on sender A, downloads them from recipient B via A's FIPS mesh IPv6 URL, validates the route proof contract, and reads FIPS counters/status as runtime evidence.

## Future Requirements

- **INST-GENERIC-01**: The Pollen-specific relay path is generalized for FIPS, Tor, I2P, Loki, and future backends after one backend is proven.
- **TURN-01**: WebRTC overlay relay candidates for FIPS/Pollen use TURN/TURNS routes only when the browser can dial the relay endpoint and relay-only ICE proof exists.
- **FIPS-NATIVE-01**: Replace or augment HTTP-over-fips0 with a native FSP API when the FIPS daemon exposes an application byte-stream API.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native FSP daemon API | Current FIPS release exposes ordinary IPv6/TCP through `fips0`; this slice proves that data plane first. |
| TURN overlay relay | Separate route type with different WebRTC proof needs. |
| Generic route-engine replacement | Existing runtime config and route-attempt surfaces are enough to enforce SPA honesty. |
| Public topology publication | Backend-only route availability must stay explicit, private, and proof-backed. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIPS-STREAM-01 | Phase 11 | Complete |
| FIPS-STREAM-02 | Phase 11 | Complete |
| FIPS-STREAM-03 | Phase 11 | Complete |
| FIPS-STREAM-04 | Phase 11 | Complete |
| FIPS-STREAM-05 | Phase 11 | Complete |

**Coverage:**
- v0.7.0 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after verifying Phase 11 FIPS stream route proof.*
