---
status: complete
created: "2026-07-08"
completed: "2026-07-08T19:41:10+02:00"
---

# Precache FIPS Host Dynamic Scripts

## Goal

Fix `.fips` host page loads where dynamically loaded app scripts fail after the service worker falls back from network to cache.

## Plan

1. Add all dynamically loaded app scripts from `public/scripts/main.js` to `public/service-worker.js` precache.
2. Add regression coverage that service worker precache includes the dynamic script loader list.
3. Verify focused service worker tests, runtime service-worker cache, browser/SPA/Docker smoke, diff check, and changed-code AI-slop scan.
