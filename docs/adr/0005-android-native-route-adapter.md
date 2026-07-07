# ADR 0005: Android Native Route Adapter Boundary

Date: 2026-07-07

Status: Accepted

## Context

Android APK builds already inject a loopback native backend into the WebView. That backend can serve FIPS status and Pollen upload/download endpoints, but the browser app had no route adapter object that exposed those native primitives through the generic route contract.

FIPS status is not byte-transfer proof. Pollen upload/download can prove a native object-store data plane by sending bytes through the Android backend, receiving them back, and validating SHA-256 plus route proof fields.

## Decision

The Android WebView app loads `scripts/android-native-routes.js`. It registers `meshdropAndroidNativeRouteAdapter`, which implements the generic route adapter method surface.

The adapter is unsupported unless `__meshdropAndroidNativeBackend.alive` and `baseUrl` are present. When available, it exposes a Pollen object-store route with descriptor, send, receive, close, and proof methods. It reports FIPS as status-only with `transferSupported: false` until a FIPS data-plane transfer proof exists.

Installed APK smoke must validate route proof through `MeshDropRouteContract.validateRouteProof`, including sender runtime, recipient runtime, route type, data-plane primitive, WebRTC flag, instance relay flag, byte counts, hash match, and fallback flag.

## Consequences

- Android native Pollen can now be tested as a route adapter instead of a status-only backend.
- FIPS remains visible for native status without overclaiming transfer support.
- Source-only artifacts still do not gain native transfer support from package metadata alone.
- Future native FIPS work can add a real FIPS send/receive primitive behind the same adapter contract.

## Verification

- `node --test test/android-native-route-adapter.test.js`
- `node --test test/mobile-package.test.js`
- `npm run test:android-fips-pollen`
