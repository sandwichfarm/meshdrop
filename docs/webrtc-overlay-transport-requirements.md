# WebRTC Overlay Transport Requirements

MeshDrop's goal is a robust, self-healing, easy-to-use sharing application that uses the Nostr social graph plus multiple network topologies to move files in as many real network conditions as possible. Privacy is the default posture, public operation remains available when chosen, and the system should work around firewalls through negotiated discovery, signaling, relays, and handoffs. The product target is signaling and WebRTC over every useful topology when that is what the user's network conditions require. WebRTC is the standard interactive transfer surface across topologies, but a topology only counts as a WebRTC transport when file bytes are constrained to that topology's ICE path, not when the topology only discovers peers or carries SDP.

## Definitions

- Discovery: finding a peer and route candidate.
- Signaling: exchanging SDP, ICE candidates, and control messages before transfer.
- WebRTC over a topology: the selected WebRTC ICE candidate pair carries file bytes through that topology.
- Clearnet file route: same-instance direct IP WebRTC, host/srflx direct Internet/LAN ICE, or direct Nostr-signaled WebRTC that can carry file bytes outside FIPS/Pollen.
- Excluding Clearnet: file transfer must not select direct Clearnet ICE candidates. Nostr discovery and signaling may remain active.

## Required Product Behavior

- Auto selection remains default. It chooses the best proven route from the allowed network set.
- Users can exclude Clearnet, FIPS, and Pollen independently.
- Blocking Clearnet blocks Clearnet file-byte routes only. It must not block Nostr identity, Nostr discovery, or Nostr signaling for non-Clearnet routes.
- Forcing FIPS means WebRTC file bytes use a FIPS-backed ICE relay/candidate, or the UI must say that FIPS can only discover/signal until the relay is available.
- Forcing Pollen means WebRTC file bytes use a Pollen-backed ICE relay/candidate, or the UI must say that Pollen can only discover/signal until the relay is available.
- A route cannot be advertised as "WebRTC over FIPS" or "WebRTC over Pollen" unless runtime proof shows the selected ICE pair is constrained to that topology.

## Technical Requirements

1. Add an ICE policy layer to route selection.
   - `auto`: current priority order, but only among allowed networks.
   - `exclude-clearnet`: keep Nostr discovery/signaling; reject host/srflx direct Clearnet candidate pairs for file transfer.
   - `force-fips`: require a FIPS-backed relay candidate.
   - `force-pollen`: require a Pollen-backed relay candidate.

2. Add overlay relay capability negotiation.
   - `/config` must report whether FIPS relay ICE and Pollen relay ICE are available.
   - The UI must show "signaling only" when relay ICE is unavailable.
   - Route choice must fail closed instead of silently falling back to direct Clearnet when a forced overlay lacks relay ICE.

3. Implement a FIPS WebRTC relay candidate.
   - Prefer a TURN-compatible relay reachable over the FIPS address space.
   - Configure WebRTC with `iceTransportPolicy: "relay"` when Clearnet is excluded and FIPS is forced.
   - Prove the selected candidate pair is relay/FIPS-backed and no direct host/srflx pair is selected.

4. Implement a Pollen WebRTC relay candidate.
   - Prefer TURN over TCP/TLS through a Pollen service tunnel.
   - If browser TURN candidate constraints make Pollen relay ICE impossible, record that explicitly and implement a non-WebRTC Pollen live-transfer fallback as a separate route with different UI text.
   - Do not label the fallback as WebRTC.

5. Add route-failure behavior.
   - If a forced overlay relay fails, report that route failure.
   - Do not auto-fallback to excluded Clearnet.
   - Auto mode may fallback only to allowed routes.

## Acceptance Tests

- Unit: disabling Clearnet leaves Nostr discovery/signaling active but rejects direct Nostr Clearnet transfer routes.
- Unit: route policy refuses `force-fips` and `force-pollen` when relay ICE capability is absent.
- Browser: with Clearnet excluded and FIPS forced, transfer succeeds and WebRTC stats show the selected pair is a FIPS relay path.
- Browser: with Clearnet excluded and Pollen forced, transfer succeeds and WebRTC stats show the selected pair is a Pollen relay path.
- Browser: with Clearnet excluded and no overlay relay available, transfer does not silently use host/srflx Clearnet ICE.
- Runtime: e2e logs name discovery/signaling proof separately from byte-transport proof.

## Non-Goals

- Treating Nostr, FIPS, or Pollen discovery as byte transport proof.
- Hiding missing relay support behind optimistic labels.
- Disabling Nostr discovery just because Clearnet file-byte routes are excluded.
