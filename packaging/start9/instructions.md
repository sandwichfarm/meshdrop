# MeshDrop

Open MeshDrop from the StartOS web interface and connect a Nostr identity before using Nostr-backed WebRTC discovery.

For shared-instance administration, configure `MESHDROP_ADMIN_NPUB` before installation so only the designated npub can
submit signed server-side settings changes.

For peer discovery across MeshDrop instances, configure `MESHDROP_DISCOVERY_NPUBS` with the npubs this instance should
discover. Do not use static room IDs for FIPS or Pollen discovery.
