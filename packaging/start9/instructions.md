# MeshDrop

Open MeshDrop from the StartOS web interface and connect a Nostr identity before using Nostr-backed WebRTC discovery.

For shared-instance administration, configure `MESHDROP_ADMIN_NPUB` before installation so only the designated npub can
submit signed server-side settings changes.

For peer discovery across MeshDrop instances, sign in with Nostr and follow/trust the target user. MeshDrop derives
FIPS and Pollen discovery rooms at runtime from the logged-in user's kind 3 follow list and NIP-65 relays.
