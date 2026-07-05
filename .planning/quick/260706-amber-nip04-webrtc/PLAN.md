---
status: complete
quick_id: 260706-amber-nip04-webrtc
slug: amber-nip04-webrtc
date: 2026-07-06
---

# Quick Task 260706: Amber NIP-04 WebRTC

## Goal

Allow an Android login through Amber/NIP-55 to satisfy the NIP-04 encryption requirement used by Nostr WebRTC discovery.

## Plan

1. Add a regression test for an Android signer-backed identity exposing NIP-04 encrypt/decrypt.
2. Add NIP-04 methods to the Android signer wrapper and route identity encryption through the active signer instead of only `window.nostr`.
3. Verify focused tests, browser smoke where practical, AI-slop gates, commit, push, and open a stacked PR on PR #103.
