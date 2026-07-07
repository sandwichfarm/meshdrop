# Requirements: MeshDrop v0.15.0 Loki Byte Transfer Proof

**Defined:** 2026-07-08
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

- Nostr WebRTC, local WebRTC, Blossom, Hashtree, Pollen storage, Pollen instance relay, and FIPS stream paths have automated transfer proof in the appropriate runtime targets.
- Runtime capability negotiation gates GUI controls by the current target's capabilities.
- Route descriptor validation, adapter vocabulary, scoring reasons, route attempts, and proof-backed completion copy exist.
- Backend-free SPA artifacts fail closed for backend-only FIPS/Pollen/native route claims while keeping pure-client Nostr WebRTC available.
- Installed Android APKs already expose a loopback native backend for FIPS status and Pollen upload/download.
- Pollen instance relay proves encrypted payload bytes through an object-store primitive and emits route proof.
- FIPS stream proof proves encrypted payload bytes over the sender's FIPS mesh IPv6 address and emits route proof.
- TURN relay proof proves browser WebRTC can be forced through a relay candidate before route-specific overlay WebRTC claims are allowed.
- Tor/I2P/Loki runtime capability surfaces already fail closed unless configured with explicit overlay stream endpoints.

## v0.15.0 Requirements

### Loki Byte Transfer Proof

- [x] **LOKI-BYTE-01**: MeshDrop reuses the generic backend overlay stream upload/download primitive for configured Loki stream routes without changing Tor, I2P, FIPS, or Pollen behavior.
- [x] **LOKI-BYTE-02**: Loki stream descriptors require a valid `.loki` endpoint, route type `loki`, primitive `loki-http-stream`, owner/session binding, expiry, byte limit metadata, and private/encrypted/fail-closed constraints.
- [x] **LOKI-BYTE-03**: A runtime smoke starts a reproducible Dockerized Lokinet daemon path, transfers a proof payload through a generated `.loki` endpoint using plain Lokinet DNS resolution, validates byte counts and SHA-256, and rejects Clearnet fallback as success.
- [x] **LOKI-BYTE-04**: Loki route proof names sender runtime, recipient runtime, route type, data-plane primitive, WebRTC flag, instance-relay flag, byte counts, hash match, fallback status, and topology evidence for the Lokinet route.
- [x] **LOKI-BYTE-05**: Issue #151 can close after merge because Tor, I2P, and Loki all have reproducible route-specific daemon/proxy byte-transfer proof.

## v0.14.0 Requirements

### I2P Byte Transfer Proof

- [x] **I2P-BYTE-01**: MeshDrop reuses the generic backend overlay stream upload/download primitive for configured I2P stream routes without changing Tor, FIPS, or Pollen behavior.
- [x] **I2P-BYTE-02**: I2P stream descriptors require a valid `.b32.i2p` endpoint, route type `i2p`, primitive `i2p-http-stream`, owner/session binding, expiry, byte limit metadata, and private/encrypted/fail-closed constraints.
- [x] **I2P-BYTE-03**: A runtime smoke starts a reproducible Dockerized i2pd HTTP proxy/server tunnel path, transfers a proof payload through the `.b32.i2p` endpoint, validates byte counts and SHA-256, and rejects Clearnet fallback as success.
- [x] **I2P-BYTE-04**: I2P route proof names sender runtime, recipient runtime, route type, data-plane primitive, WebRTC flag, instance-relay flag, byte counts, hash match, fallback status, and topology evidence for the I2P route.
- [x] **I2P-BYTE-05**: Loki stays unavailable/fail-closed with GitHub issue #151 still tracking future daemon/proxy byte-transfer proof.

## v0.13.0 Requirements

### Tor Byte Transfer Proof

- [x] **TOR-BYTE-01**: MeshDrop exposes a generic backend overlay stream upload/download primitive that can serve short-lived encrypted payloads for configured overlay networks without changing FIPS/Pollen behavior.
- [x] **TOR-BYTE-02**: Tor stream descriptors require a valid `.onion` endpoint, route type `tor`, primitive `tor-http-stream`, owner/session binding, expiry, byte limit metadata, and private/encrypted/fail-closed constraints.
- [x] **TOR-BYTE-03**: A runtime smoke starts a reproducible Dockerized Tor hidden service/proxy path, transfers a proof payload through the onion endpoint, validates byte counts and SHA-256, and rejects Clearnet fallback as success.
- [x] **TOR-BYTE-04**: Tor route proof names sender runtime, recipient runtime, route type, data-plane primitive, WebRTC flag, instance-relay flag, byte counts, hash match, fallback status, and topology evidence for the onion route.
- [x] **TOR-BYTE-05**: I2P and Loki stay unavailable/fail-closed with GitHub issue #151 still tracking their future daemon/proxy byte-transfer proof.

## v0.12.0 Requirements

### Route Blocker Issue Tracking

- [x] **BLOCKER-01**: MeshDrop records Tor/I2P/Loki byte-transfer proof as blocked on a reproducible local daemon/proxy dial surface, with GitHub issue acceptance criteria for future runtime proof: https://github.com/sandwichfarm/meshdrop/issues/151.
- [x] **BLOCKER-02**: MeshDrop records FIPS/Pollen route-specific WebRTC relay proof as blocked on a relay endpoint reachable through the named overlay, with GitHub issue acceptance criteria for future topology proof: https://github.com/sandwichfarm/meshdrop/issues/152.
- [x] **BLOCKER-03**: MeshDrop records GHCR anonymous release image readback as blocked until public package visibility or an explicit authenticated distribution contract is proven: https://github.com/sandwichfarm/meshdrop/issues/156.
- [x] **BLOCKER-04**: MeshDrop records deployed StartOS and Umbrel node UAT as blocked until real installed services are available and pass deployed transfer harnesses: https://github.com/sandwichfarm/meshdrop/issues/157.
- [x] **BLOCKER-05**: MeshDrop records signed iOS device install and share-transfer UAT as blocked until macOS signing hardware and a real device produce transfer proof: https://github.com/sandwichfarm/meshdrop/issues/158.

## v0.8.0 Requirements

### Generic Instance Relay

- [x] **INST-GEN-01**: MeshDrop exposes a generic browser instance-relay protocol that builds v1 `transportShape=instance-relay` descriptors for any supported route type while enforcing owner pubkey, session ID, expiry, endpoint primitive, private/encrypted/fail-closed constraints, and `instanceRelay=true`.
- [x] **INST-GEN-02**: Generic instance-relay proof seeds and final route proofs require sender runtime, recipient runtime, route type, data-plane primitive, byte counts, `webRtcUsed=false`, `instanceRelayed=true`, `hashMatched=true`, and `fallbackUsed=false`.
- [x] **INST-GEN-03**: Generic instance-relay request validation rejects missing proof seed, missing owner/session binding, owner/session mismatch, expired descriptors, primitive mismatch, WebRTC byte-path claims, missing instance-relay flags, and fallback flags before any download/decrypt path can claim success.
- [x] **INST-GEN-04**: The existing Pollen instance-relay flow uses the generic instance-relay protocol without changing its public metadata shape, ciphertext upload/download behavior, route proof fields, or focused/browser runtime proof.
- [x] **INST-GEN-05**: ADRs document that this milestone generalizes relay descriptor/proof semantics only; it must not claim new FIPS/Tor/I2P/Loki byte-transfer support without route-specific runtime proof.

## v0.10.0 Requirements

### Overlay Network Adapters

- [x] **ONA-01**: Runtime capabilities include Tor, I2P, and Loki transport entries that are unsupported by default and fail closed with explicit unavailable reasons.
- [x] **ONA-02**: Server-side overlay adapter config normalizes Tor/I2P/Loki through one catalog instead of route-specific one-off code.
- [x] **ONA-03**: Configured overlay adapters expose `transportShape=stream`, route-specific `*-http-stream` primitives, endpoint metadata, and max byte limits without changing existing FIPS/Pollen behavior.
- [x] **ONA-04**: Backend-free SPA/source targets refuse backend-only Tor/I2P/Loki claims unless a future native/browser route surface proves support.
- [x] **ONA-05**: Route descriptor/scoring tests cover Tor/I2P/Loki as ordinary private stream candidates and state that byte-transfer completion remains blocked until real local dial proof exists.

## Future Requirements

- **OVERLAY-WEBRTC-01**: FIPS/Pollen route-specific WebRTC relay claims stay unavailable until a relay endpoint reachable through that route proves selected relay candidates and no Clearnet fallback. Tracked by https://github.com/sandwichfarm/meshdrop/issues/152.

## v0.11.0 Requirements

### TURN Relay Proof

- [x] **TURN-01**: A local TURN/coturn smoke starts a relay endpoint and a MeshDrop target configured with TURN credentials through the existing RTC config surface.
- [x] **TURN-02**: Relay-only WebRTC transfer proof verifies a browser-to-browser payload through `iceTransportPolicy=relay`, with WebRTC stats showing the selected candidate pair is `relay` and not host/srflx/prflx.
- [x] **TURN-03**: The relay proof names sender runtime, recipient runtime, selected route type, data-plane primitive, `webRtcUsed=true`, `instanceRelayed=false`, bytes sent/received, hash match, and `fallbackUsed=false`.
- [x] **TURN-04**: Runtime capability and route-selection tests keep FIPS/Pollen overlay WebRTC unavailable unless relay ICE config exists, and prevent fallback to excluded Clearnet when relay-only policy fails.
- [x] **TURN-05**: ADR/docs state that TURN relay proof is the generic browser WebRTC relay prerequisite; FIPS/Pollen/Tor/I2P/Loki overlay labels remain unavailable until their configured relay path has route-specific proof.

## v0.9.0 Requirements

### FIPS Instance Relay

- [x] **FIPS-IR-01**: FIPS builds generic `transportShape=instance-relay` descriptors for encrypted payload descriptors served from a validated FIPS mesh IPv6 base URL.
- [x] **FIPS-IR-02**: Private FIPS transfer requests attach `fipsInstanceRelay` metadata with owner pubkey, session ID, data-plane primitive `fips-http-stream`, `webRtcUsed=false`, `instanceRelayed=true`, bytes sent, and fallback disabled.
- [x] **FIPS-IR-03**: Recipient validation prefers `fipsInstanceRelay`, rejects owner/session/expiry/primitive/WebRTC/fallback/hash mismatches before success, and emits route proof with bytes received and hash match.
- [x] **FIPS-IR-04**: Legacy requests containing only `fipsStream` remain accepted and continue to emit legacy FIPS stream proof with `instanceRelayed=false`.
- [x] **FIPS-IR-05**: Focused tests, FIPS stream runtime smoke, broad tests, Docker smoke, and changed-code slop gate prove the slice before merge.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public Lokinet reachability | This milestone proves a deterministic local Lokinet daemon/SNApp byte path; public network reachability has separate bootstrap and availability concerns. |
| Loki WebRTC transport | This milestone proves non-WebRTC `loki-http-stream`; route-specific WebRTC needs relay-candidate proof like other overlays. |
| FIPS instance-to-instance chunk relay | FIPS has direct FIPS stream proof; instance-to-instance relay is the next transport-specific slice. |
| Native FSP daemon API | Current FIPS release exposes ordinary IPv6/TCP through `fips0`; native FSP remains future work. |
| TURN overlay relay | Separate route type with different WebRTC proof needs. |
| Generic route-engine replacement | Existing runtime config and route-attempt surfaces are enough for this contract slice. |
| Public topology publication | Backend-only route availability must stay explicit, private, and proof-backed. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOKI-BYTE-01 | Phase 19 | Complete |
| LOKI-BYTE-02 | Phase 19 | Complete |
| LOKI-BYTE-03 | Phase 19 | Complete |
| LOKI-BYTE-04 | Phase 19 | Complete |
| LOKI-BYTE-05 | Phase 19 | Complete |
| I2P-BYTE-01 | Phase 18 | Complete |
| I2P-BYTE-02 | Phase 18 | Complete |
| I2P-BYTE-03 | Phase 18 | Complete |
| I2P-BYTE-04 | Phase 18 | Complete |
| I2P-BYTE-05 | Phase 18 | Complete |
| TOR-BYTE-01 | Phase 17 | Complete |
| TOR-BYTE-02 | Phase 17 | Complete |
| TOR-BYTE-03 | Phase 17 | Complete |
| TOR-BYTE-04 | Phase 17 | Complete |
| TOR-BYTE-05 | Phase 17 | Complete |
| INST-GEN-01 | Phase 12 | Complete |
| INST-GEN-02 | Phase 12 | Complete |
| INST-GEN-03 | Phase 12 | Complete |
| INST-GEN-04 | Phase 12 | Complete |
| INST-GEN-05 | Phase 12 | Complete |
| FIPS-IR-01 | Phase 13 | Complete |
| FIPS-IR-02 | Phase 13 | Complete |
| FIPS-IR-03 | Phase 13 | Complete |
| FIPS-IR-04 | Phase 13 | Complete |
| FIPS-IR-05 | Phase 13 | Complete |
| ONA-01 | Phase 14 | Complete |
| ONA-02 | Phase 14 | Complete |
| ONA-03 | Phase 14 | Complete |
| ONA-04 | Phase 14 | Complete |
| ONA-05 | Phase 14 | Complete |
| TURN-01 | Phase 15 | Complete |
| TURN-02 | Phase 15 | Complete |
| TURN-03 | Phase 15 | Complete |
| TURN-04 | Phase 15 | Complete |
| TURN-05 | Phase 15 | Complete |
| BLOCKER-01 | Phase 16 | Complete |
| BLOCKER-02 | Phase 16 | Complete |
| BLOCKER-03 | Phase 16 | Complete |
| BLOCKER-04 | Phase 16 | Complete |
| BLOCKER-05 | Phase 16 | Complete |

**Coverage:**
- v0.15.0 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-07-08*
*Last updated: 2026-07-08 completing Phase 19 Loki Byte Transfer Proof.*
