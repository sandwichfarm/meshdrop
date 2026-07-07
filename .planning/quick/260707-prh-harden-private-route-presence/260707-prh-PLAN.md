---
status: complete
date: 2026-07-07
quick_id: 260707-prh
slug: harden-private-route-presence
---

# Plan: Harden Private Route Presence

## Goal

Tighten the two-stage route discovery implementation against the pasted privacy requirements: WOT presence should advertise one MeshDrop WebRTC capability token plus route capability flags only, plaintext route-detail payloads must fail closed, and logs should show route capability acceptance or rejection without exposing route details.

## Tasks

1. Restrict public WOT presence tags to `type`, `capability`, `peer`, and `expiration`.
2. Require the single `meshdrop-webrtc` capability for Nostr Mesh presence instead of split legacy `meshdrop` plus `webrtc` capabilities.
3. Reject plaintext route request/response bodies before joining FIPS/Pollen route rooms or publishing responses.
4. Log accepted/rejected route capability decisions without logging decrypted route descriptors or invite/base details.
5. Rerun protocol, repo, browser, Docker, diff, and AI-slop gates.
