# Summary

Auto route selection remains priority-based, but the user can now exclude the clearnet route class. Clearnet exclusion gates direct `ip` and direct Nostr-signaled `nostr` WebRTC routes while leaving FIPS and Pollen route candidates available.

Nostr copy now distinguishes discovery/signaling from byte transport. Route status text uses network classes such as `Clearnet`, `FIPS`, and `Pollen`, so a Nostr-discovered direct WebRTC route no longer renders as "Connected via Nostr".

## Verification

- `npm test -- test/local-discovery-protocol.test.js test/header-copy.test.js test/peer-availability-protocol.test.js test/rtc-peer-signaling.test.js` -> 40/40 pass
- `npm test` -> 282/282 pass
- `npm run test:e2e` -> pass, including local WebRTC, Blossom, Hashtree, Pollen storage, direct Nostr WebRTC, FIPS candidate, and federated Pollen public WebRTC proofs
- `git diff --check` -> pass
- `npx --yes aislop scan --changes .` -> 0 AI-slop/security/lint issues; pre-existing code-quality warnings for touched large files and duplicate blocks remain
- `npx --yes aislop scan .` -> baseline fails with existing warnings in noble-ciphers, large files, duplicate blocks, long functions, hardcoded URL, TODOs, and empty function body

## Known Gaps

- The clearnet toggle reuses the existing local discovery control and storage key. That preserves user intent but means an older disabled local-discovery preference now disables direct Nostr-signaled clearnet routes too.
- Full-repo aislop baseline is still failing outside this task.

## Follow-up Correction

- Clearnet exclusion must not block Nostr discovery. It blocks clearnet file-sharing routes: same-instance IP and direct Nostr-signaled WebRTC byte paths.
- Static/backend-free targets may lack same-instance local discovery support, but that must not make the clearnet preference look disabled. The route policy now reads the persisted clearnet preference before falling back to controller runtime support.
