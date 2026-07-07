# Requirements: MeshDrop v0.6.0 Android Native Route Adapter

**Defined:** 2026-07-07
**Core Value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.

## Validated Baseline

- Nostr WebRTC, local WebRTC, Blossom, Hashtree, Pollen storage, and Pollen instance-relay paths have automated transfer proof in the appropriate runtime targets.
- Runtime capability negotiation gates GUI controls by the current target's capabilities.
- Route descriptor validation, adapter vocabulary, scoring reasons, route attempts, and proof-backed completion copy exist.
- Backend-free SPA artifacts fail closed for backend-only FIPS/Pollen/native route claims while keeping pure-client Nostr WebRTC available.
- Installed Android APKs already expose a loopback native backend for FIPS status and Pollen upload/download.

## v0.6.0 Requirements

### Android Native Adapter

- [x] **ANDROID-NATIVE-01**: Android WebView runtime registers a route adapter that passes `MeshDropRouteContract.validateAdapter` only when the loopback native backend is alive.
- [x] **ANDROID-NATIVE-02**: The adapter exposes native Pollen status, descriptor, send, receive, and proof behavior using the Android backend upload/download primitive.
- [x] **ANDROID-NATIVE-03**: The adapter reports FIPS native status without claiming FIPS byte-transfer proof until the FIPS data plane is implemented.

### Installed APK Proof

- [x] **ANDROID-NATIVE-04**: Installed APK smoke sends and receives bytes through the native Pollen route adapter, verifies byte count and SHA-256 hash, and validates route proof fields: sender runtime, recipient runtime, route type, data-plane primitive, WebRTC flag, instance relay flag, bytes sent/received, hash match, and fallback false.
- [x] **ANDROID-NATIVE-05**: Android source/APK packaging includes the adapter script without changing source-only artifact honesty.

## Future Requirements

- **FIPS-01**: FIPS adapter transfers encrypted file bytes over a FIPS-backed data plane and reports route proof.
- **NATIVE-01**: Android native adapter exposes real native route status, descriptor, transfer primitive, and proof.
- **INST-GENERIC-01**: The Pollen-specific relay path is generalized for FIPS, Tor, I2P, Loki, and future backends after one backend is proven.
- **TURN-01**: WebRTC overlay relay candidates for FIPS/Pollen use TURN/TURNS routes only when the browser can dial the relay endpoint and relay-only ICE proof exists.

## Out of Scope

| Feature | Reason |
|---------|--------|
| FIPS byte-transfer implementation | This milestone exposes FIPS status only; the FIPS data plane remains a later transport slice. |
| iOS native transport adapter | This slice is Android-only. |
| Generic route-engine replacement | Existing runtime config and route-attempt surfaces are enough to enforce SPA honesty. |
| Public topology publication | Backend-only route availability must stay explicit, private, and proof-backed. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANDROID-NATIVE-01 | Phase 10 | Complete |
| ANDROID-NATIVE-02 | Phase 10 | Complete |
| ANDROID-NATIVE-03 | Phase 10 | Complete |
| ANDROID-NATIVE-04 | Phase 10 | Complete |
| ANDROID-NATIVE-05 | Phase 10 | Complete |

**Coverage:**
- v0.6.0 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-07-07*
*Last updated: 2026-07-07 after completing Phase 10 Android native route adapter.*
