# Clearnet Route Control Visibility

Goal: fix the UI/model confusion where the only Clearnet exclusion control is hidden or reads like a generic WebRTC/Nostr toggle, while FIPS and Pollen are presented as if they guarantee WebRTC bytes over those overlays.

Scope:
- Keep Nostr discovery independent from Clearnet file-route exclusion.
- Show the Clearnet file-route control whenever same-instance Clearnet or direct Nostr-signaled Clearnet routes are possible.
- Keep the footer Clearnet badge tied to actual same-instance discovery, not the route policy alone.
- Update FIPS/Pollen copy to say they are discovery/signaling routes unless a real relay-only ICE path exists.
- Add explicit requirements for the actual WebRTC-over-FIPS/Pollen work so the relay gap is tracked, not silently deferred.

Verification:
- Focused route/control unit tests.
- Header/footer copy tests.
- Overlay relay requirements doc.
- Repo gates required by AGENTS.md before commit.
