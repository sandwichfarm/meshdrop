---
status: complete
completed: "2026-07-07T22:34:00Z"
---

# Route Status No-Text DOM Summary

Cleared fallback route-status words from peer cards when icon route chips render.

## Changed

- Route-attempt rendering now returns whether compact chips are present.
- Peer-card `.status` text is emptied and marked `aria-hidden` while route chips are visible.
- Route-attempt chip rows carry grouped ARIA detail, preserving Clearnet/FIPS/Pollen status for assistive tech and tooltips.
- Regression coverage locks the no-visible-status-text behavior.

## Evidence

- `node --test test/route-attempts-ui.test.js` passed 10/10.
- Browser proof on `http://127.0.0.1:33077`: visible peer text was `NADAR2`; route row text and chip text were empty; status text was empty with `aria-hidden=true`; Clearnet tone was `blocked` with opacity `0.44`; FIPS/Pollen tones were `pending` with `route-chip-pulse`.
- Screenshot: `/tmp/meshdrop-patched-route-icon-proof.png`.
- `npm test` passed 363/363.
- `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` passed, including local, Blossom, Hashtree, Pollen storage, Nostr WebRTC, FIPS candidate honesty, and federated Pollen proofs.
- `git diff --check` passed.
- `npx --yes aislop scan --changes .` reported 0 AI-slop, security, formatting, and lint issues.

## Remaining Risk

- `aislop --changes` still reports pre-existing code-quality warnings because `public/scripts/ui.js` is a large legacy file with duplicate blocks outside this change.
- Full-repo slop scan not run for this narrow UI hardening slice.
