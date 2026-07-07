---
gsd_state_version: 1.0
milestone: v0.4.0
milestone_name: Route Attempts UX
status: verification
last_updated: "2026-07-07T13:52:13.608Z"
last_activity: 2026-07-07
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# GSD State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-07)

**Core value:** Files must transfer between trusted peers over the route MeshDrop claims it selected, with encrypted bytes, receiver verification, and no silent fallback.
**Current focus:** make route selection legible in the UI by showing route candidates, attempt states, failure reasons, privacy labels, and proof-backed completion.

## Milestone Audit: 2026-07-06

Merged PRs through #105 satisfy the source/runtime/harness portions of the original finish-line milestone:

- Phase 1 transfer/discovery correctness is complete for claimed paths: local, FIPS, Pollen, Nostr, federated FIPS,
  Docker local/Pollen/two-host/public relay, SPA Chromium/Firefox/WebKit, Desktop Chromium, Android WebView, and
  target-artifact source transfers now use real transfer proof instead of mock-only success.

- Phase 2 runtime capability negotiation is complete for current targets: `/config`, static target manifests, and GUI
  controllers gate controls by runtime capability and identity.

- Phase 3 Docker shared-instance admin is complete for the repo contract: compose/runtime admin npub config, `/config`
  metadata, GUI visibility, backend signed-event validation, FIPS settings updates, and restart requests are covered by
  focused tests plus Docker/admin UAT.

- Phase 4 platform work is complete for automated build/run/runbook proof and Android physical hardware UAT, but not
  for StartOS/Umbrel node acceptance or signed iOS device acceptance.

- Phase 5 CI/release automation is complete for authenticated release publication/readback through `v0.1.5`, but
  anonymous GHCR readback still fails before release images can be called publicly readable.

Current hard gaps:

- `npm run verify:ghcr-anonymous -- v0.1.5` fails with GHCR `unauthorized`.
- `gh api /orgs/sandwichfarm/packages/container/meshdrop` fails with `403` because this token lacks `read:packages`, so
  this session cannot inspect or change package visibility.

- Deployed StartOS/Umbrel UAT and signed iOS device package/UAT remain unproven; the repo now has a fail-loud signed
  iOS device-install harness that must pass on macOS hardware before those claims can close.

Closed during this audit branch:

- `npm run test:android-physical-device` passed on Google Pixel 7 Pro `28031FDH300BS5`, proving APK install, WebView
  capability, WebView Nostr WebRTC transfer, Android share-intent transfer, and native picker UI on physical hardware.

- `v0.1.5` was tagged from `5876d8e`, published release assets and GHCR target images, passed authenticated readback,
  and failed only at anonymous GHCR manifest readback with `unauthorized`.

## Quick Tasks Completed

| Date | Task | Status | Evidence |
|------|------|--------|----------|
| 2026-07-07 | `260707-i6u-add-external-uat-status-report-mode` | complete | External UAT status/final JSON reports added; focused 10/10; `npm test` 311/311; status/final blockers recorded; diff/changed-code slop gates |
| 2026-07-07 | `260707-hq6-add-configurable-overlay-relay-ice-plumb` | complete | FIPS/Pollen relay ICE requires TURN/TURNS config and route selection uses route-specific relay-only RTC config; focused 82/82; `npm test` 306/306; e2e; diff/slop gates |
| 2026-07-07 | `260707-h8o-add-fail-closed-overlay-relay-capability` | complete | FIPS/Pollen relay ICE defaults unavailable; Clearnet-off FIPS/Pollen WebRTC fails closed without relay ICE and relay-enabled routes use relay-only RTC config; focused 78/78; `npm test` 302/302; e2e; Docker smoke; diff/slop gates |
| 2026-07-07 | `260707-64a-fix-clearnet-off-peer-route-ui-so-nostr-` | complete | Focused 42/42; `npm test` 295/295; e2e; Docker smoke; diff/slop gates |
| 2026-07-04 | `20260704-admin-npub-signed-settings` | complete | Admin tests 7/7; repo/e2e/docker/diff/slop gates |
| 2026-07-04 | `20260704-ci-test-baseline` | complete | `npm ci`; repo/e2e/docker/actionlint/diff gates; changed-code slop exit 0 |
| 2026-07-04 | `20260704-fix-browser-ci-local-disable` | complete | e2e transfer proof; `npm test`; `git diff --check` |
| 2026-07-04 | `20260704-fix-browser-ci-bidirectional-ready` | complete | e2e transfer proof; `npm test`; changed-code slop exit 0 |
| 2026-07-04 | `20260704-release-ceremony-baseline` | complete | actionlint; release artifact smoke; `npm test`; `npm run test:docker`; diff/slop gates |
| 2026-07-04 | `20260704-runtime-capability-contract` | complete | focused red/green tests; `npm test`; e2e transfer proof; Docker smoke; diff/slop gates |
| 2026-07-04 | `20260704-spa-runtime-capabilities` | complete | static SPA browser proof; `npm test`; e2e transfer proof; Docker smoke; diff/slop gates |
| 2026-07-04 | `260704-kkw-fix-federated-fips-rtc-glare-so-e2e-tran` | complete | focused red/green RTC test; `npm test`; e2e transfer proof; Docker smoke; diff/slop gates |
| 2026-07-04 | `260704-krw-add-a-buildable-static-spa-release-artif` | complete | SPA artifact unit/smoke; `npm test`; e2e transfer proof; Docker smoke; actionlint; diff/slop gates |
| 2026-07-04 | `260704-l0o-run-the-static-spa-artifact-browser-smok` | complete | actionlint; SPA artifact browser smoke; diff/slop gates |
| 2026-07-04 | `20260704-platform-uat-runbooks` | complete | red/green UAT doc guard; `npm test`; diff/slop gates |
| 2026-07-04 | `20260704-docker-browser-transfer-smoke` | complete | Docker-served local WebRTC proof; `npm test`; actionlint; diff/slop gates |
| 2026-07-04 | `20260704-docker-pollen-transfer-smoke` | complete | Docker-served local and Pollen WebRTC proof; `npm test`; diff/slop gates |
| 2026-07-04 | `20260704-docker-admin-gui-smoke` | complete | Docker-served signed admin GUI proof; `npm test`; diff/slop gates |
| 2026-07-04 | `20260704-spa-backend-free-transfer-smoke` | complete | SPA Nostr WebRTC proof; focused test; diff/slop gates |
| 2026-07-04 | `20260704-umbrel-package-artifact` | complete | Umbrel package build/test; `npm test`; diff/slop gates |
| 2026-07-04 | `20260704-start9-package-source-artifact` | complete | Start9 source build/test; `npm test`; diff/slop gates |
| 2026-07-04 | `20260704-release-multiarch-images` | complete | Release workflow test; UAT guard; YAML parse; `npm test`; diff gates |
| 2026-07-04 | `20260704-release-verification-workflow` | complete | Release workflow test; UAT guard; YAML parse; dispatch run `28711452622` |
| 2026-07-04 | `20260704-release-v010-readback` | complete | Release `v0.1.0`; release run `28711136765`; verification run `28711452622` |
| 2026-07-04 | `20260704-spa-browser-matrix` | complete | PR #29; master CI run `28712787297`; Chromium/Firefox SPA transfer proof; WebKit runtime proof |
| 2026-07-04 | `20260704-docker-transfer-timeout-fix` | complete | PR #30; master CI run `28713014340`; Docker smoke passed |
| 2026-07-04 | `20260704-spa-public-relay-uat` | complete | PR #32; manual CI run `28713488687` public relay jobs passed for Chromium/Firefox |
| 2026-07-04 | `20260704-federated-fips-offer-recovery` | complete | PR #33; master CI run `28713678271`; Browser transfer smoke passed |
| 2026-07-04 | `20260704-spa-webkit-transfer-uat-attempt` | complete | Harness opt-in added; Chromium SPA transfer still passes; local forced WebKit attempt blocked by missing Playwright WebKit `webkit-2311`; WebKit transfer gap remains open |
| 2026-07-04 | `20260704-spa-webkit-transfer-crash-evidence` | complete | PRs #35-#37 merged; manual runs `28713995244`, `28714194498`, and `28714388605` all failed forced WebKit transfer with page crashes while normal WebKit runtime matrix passed; WebKit transfer gap remains open |
| 2026-07-04 | `20260704-spa-webkit-transfer-strategy` | complete | Manual CI run `28716511864`; `SPA WebKit transfer UAT` passed with `Proof backend-free-spa-nostr-webrtc:webkit: nostr delivered meshdrop-spa-proof.txt`; all regular CI jobs passed |
| 2026-07-04 | `20260704-docker-two-host-relay-uat` | complete | Deterministic two-container Nostr WebRTC proof; `npm test`; Docker smoke; actionlint; diff/slop gates |
| 2026-07-04 | `20260704-docker-public-relay-uat` | complete | PR CI run `28715161999`; manual run `28715209725` Docker public relay UAT passed against `wss://bucket.coracle.social`; changed-code slop clean |
| 2026-07-04 | `20260704-docker-deployed-admin-uat` | complete | Isolated compose deployed-admin proof; signed admin GUI saved FIPS peers against real FIPS control; local and Pollen browser transfers passed |
| 2026-07-04 | `20260704-start9-package-typecheck` | complete | Generated Start9 source `npm run check` passed; `make` reached `start-cli s9pk pack` and is blocked by missing local `start-cli`; `.s9pk` and device UAT remain open |
| 2026-07-04 | `20260704-start9-s9pk-pack` | complete | Generated Start9 source `npm run build` emits `javascript/index.js`; isolated `start-cli 0.4.0-beta.10` pack reaches squashfs packaging and is blocked by missing local `tar2sqfs`; `.s9pk` and device UAT remain open |
| 2026-07-04 | `260704-u4g-prove-start9-s9pk-packaging-with-tar2sqf` | complete | Generated `bin/tar2sqfs` fallback plus isolated `start-cli 0.4.0-beta.10` produced `meshdrop_x86_64.s9pk`; SHA-256 `4a166eb17d1b51e09f38b63980dcf3a05acb1b889069d00bcc34ff4c043e91a1`; device install and transfer UAT remain open |
| 2026-07-04 | `260704-dnt-desktop-native-source-artifact` | complete | Desktop source artifact build/test; `npm test`; archive manifest readback; diff/slop gates; native shell and transfer UAT remain open |
| 2026-07-04 | `260704-mob-mobile-source-artifacts` | complete | iOS/Android source artifact builds/tests; `npm test`; archive manifest readback; diff/slop gates; native shells, Bluetooth, and mobile transfer UAT remain open |
| 2026-07-04 | `260704-rat-release-all-target-artifacts` | complete | Release workflow now builds/verifies Desktop/iOS/Android source tarballs; focused tests, actionlint, YAML parse, `npm test`, diff/slop gates |
| 2026-07-04 | `260704-vcs-artifact-transfer-smoke` | complete | Desktop/iOS/Android source artifacts read target manifests and transfer proof files over Nostr WebRTC; `npm test`; target-artifact smoke; diff/slop gates |
| 2026-07-04 | `260704-vlf-target-artifact-ci` | complete | CI runs target-artifact transfer smoke after unit tests; red/green workflow guard; actionlint; target-artifact smoke; `npm test`; diff/slop gates |
| 2026-07-04 | `260704-vqw-umbrel-package-smoke` | complete | Rendered Umbrel package compose booted, `/config` reported target `umbrel`, and browser proof transferred over local and Pollen WebRTC; `npm test`; diff/slop gates |
| 2026-07-04 | `260704-start9-package-smoke` | complete | Generated Start9 package env booted the Start9 target image, `/config` reported target `start9`, and browser proof transferred over local and Pollen WebRTC; `npm test`; diff/slop gates |
| 2026-07-04 | `260704-ghcr-anonymous-readback` | complete | Local anonymous verifier added; `npm run verify:ghcr-anonymous -- v0.1.0` proves current GHCR `unauthorized`; package API requires `read:packages`; `npm test`; changed-code slop clean |
| 2026-07-04 | `260704-bluetooth-capability-gate` | complete | Runtime/static config now reports Bluetooth unsupported until a real transport exists; red/green focused tests; `npm test`; changed-code slop clean |
| 2026-07-04 | `260704-release-anonymous-verifier-ci` | complete | Release verification workflow calls local anonymous GHCR verifier; focused red/green test; YAML parse; `npm test`; changed-code slop clean |
| 2026-07-04 | `260704-release-auto-verify` | complete | Tagged alpha releases call reusable release readback after GHCR target images publish; focused red/green test; YAML parse; `npm test`; changed-code slop clean |
| 2026-07-04 | `260704-release-smoke-before-anon` | complete | Release verifier runs Docker smoke before anonymous GHCR visibility gate; focused red/green test; YAML parse; `npm test`; changed-code slop clean |
| 2026-07-05 | `20260705-release-v012-status` | complete | Release UAT docs now point at `v0.1.2` assets, GHCR target images, Docker smoke proof, and anonymous GHCR blocker; focused red/green UAT guard |
| 2026-07-05 | `20260705-desktop-native-linux-shell` | complete | Linux GTK/WebKit shell artifact builds and config-smokes; release workflow will include `meshdrop-desktop-linux`; native transfer UAT still open |
| 2026-07-05 | `260705-0x0-prove-packaged-linux-gtk-webkit-desktop-` | complete | Packaged GTK/WebKit shell WebDriver smoke proves Desktop Native manifest injection and WebRTC gate-off; native transfer UAT still open |
| 2026-07-05 | `260705-mns-mobile-native-shell-source-artifacts` | complete | iOS/Android native-source wrapper artifacts build and release verifier expects them; app package/device transfer UAT still open |
| 2026-07-05 | `260705-mnci-mobile-native-source-ci` | complete | PR CI runs iOS/Android native-source package scripts and tar readbacks after unit tests |
| 2026-07-05 | `260705-dcs-desktop-chromium-shell-uat` | complete | Chromium desktop shell artifact transfers `meshdrop-desktop-chromium-proof.txt` over Nostr WebRTC; GTK/WebKit remains gated; installer/bundled engine open |
| 2026-07-05 | `260705-v13-release-v013-readback` | complete | `v0.1.3` release assets, GHCR target images, authenticated readback, and Docker smoke passed; anonymous GHCR still returns `unauthorized` |
| 2026-07-05 | `260705-303-add-an-android-apk-package-artifact-with` | complete | Android debug APK artifact builds; `npm run test:android-apk`; `npm test`; workflow lint; changed-code slop clean |
| 2026-07-05 | `260705-3ni-record-v014-release-proof` | complete | `v0.1.4` release assets include Android APK; GHCR target images, authenticated readback, and Docker smoke passed; anonymous GHCR still returns `unauthorized` |
| 2026-07-05 | `260705-3wu-prove-android-apk-emulator-install` | complete | Android debug APK installs and launches on local AVD `Medium_Phone_API_36.1`; native transfer/signing/device UAT remain open |
| 2026-07-05 | `260705-4aw-prove-android-webview-runtime-capabilities` | complete | Installed Android WebView exposes RTCPeerConnection, WebSocket, and RTCDataChannel probe over CDP; native file-transfer proof remains open |
| 2026-07-05 | `260705-btn-bluetooth-transport-negotiation` | complete | Runtime/static config negotiates Bluetooth API/bridge availability while keeping transfer unsupported; focused 13/13; `npm test`; diff/check; changed-code slop clean |
| 2026-07-05 | `260705-rgc-runtime-gui-capability-gates` | complete | Nostr/Blossom/Hashtree controls follow negotiated runtime capabilities; focused 19/19; `npm test`; diff/check; changed-code slop clean |
| 2026-07-05 | `260705-dcb-desktop-chromium-bundled-engine` | complete | Desktop Chromium artifact can bundle `bin/chromium/chrome` and transfer over Nostr WebRTC using it; focused 11/11; `npm test`; diff/check; changed-code slop clean |
| 2026-07-05 | `260705-rbd-release-bundled-desktop-chromium` | complete | Release workflow builds and release-readback expects `meshdrop-desktop-chromium-bundled-<version>.tar.gz`; focused release workflow test green |
| 2026-07-05 | `260705-cig-ci-runtime-change-gates` | complete | CI classifies runtime-affecting paths before heavyweight runtime jobs; focused CI workflow test green |
| 2026-07-05 | `260705-dbp-desktop-chromium-binary-proof` | complete | Desktop Chromium artifacts include a compiled Linux launcher binary; bundled Chromium transfer smoke passes through the binary launcher |
| 2026-07-05 | `260705-abw-android-webview-bluetooth-negotiation` | complete | Installed Android WebView smoke proves Bluetooth capability negotiation with `Bluetooth transfer=false`; Android APK metadata no longer lists Bluetooth negotiation as remaining proof; changed-code slop clean |
| 2026-07-05 | `260705-dsi-desktop-signed-installer-proof` | complete | Signed Desktop Chromium `.run` installer verifies SHA256/GPG signature, installs, and launches packaged config; bundled Chromium transfer still passes |
| 2026-07-05 | `260705-r4n-ios-simulator-app-package` | complete | Unsigned iOS Simulator `.app` package builds from generated Xcode source; signed/device iOS UAT remains open |
| 2026-07-05 | `260705-rt0-release-ios-simulator-app-artifact` | complete | Release workflow builds the iOS Simulator app on macOS, publishes it with alpha release assets, and readback expects it; focused tests, YAML parse, `npm test`, diff/slop gates |
| 2026-07-05 | `260705-ryy-ios-bluetooth-negotiation` | complete | iOS native-source artifacts explicitly negotiate Bluetooth as unsupported with no API, no native bridge, and no transfer support; focused 8/8; `npm test`; diff/slop gates |
| 2026-07-05 | `260705-ida-ios-device-app-proof` | complete | Unsigned generic `iphoneos` device app builder, CI smoke, and release readback added after CI rejected unsigned archive validation; focused 17/17; `npm test` 206/206; diff/check; changed-code slop clean |
| 2026-07-05 | `260705-tps-transfer-proof-specific-payloads` | complete | Docker local, Pollen, and two-host WebRTC smokes now send/assert scenario-specific proof files; `npm test` 206/206; Docker runtime proof; diff/check; changed-code slop clean |
| 2026-07-05 | `260705-apd-android-physical-device-uat-harness` | complete | Physical Android UAT harness rejects no-device/emulator/ambiguous states and runs existing Android smokes by serial; hardware pass remains open |
| 2026-07-05 | `260705-dtu-deployed-target-uat-harness` | complete | Start9/Umbrel deployed UAT harnesses require installed service URLs, validate `/config`, and run local/Pollen WebRTC transfer proof; real device/node pass remains open |
| 2026-07-05 | `260705-asa-android-safe-area-and-signer-options` | complete | Focused 28/28; e2e transfer smoke passed after CI expectation fix; `npm test` 220/220; physical Android WebView WebRTC/WebSocket proof on `28031FDH300BS5`; live CDP shows safe-area, Nostr button visible, Amber signer options |
| 2026-07-06 | `260706-amber-nip04-webrtc` | complete | Android Amber signer exposes NIP-04/NIP-44 through active identity signer; focused 30/30; `npm test` 222/222; Android APK build; e2e transfer smoke; diff/slop gates |
| 2026-07-06 | `260706-android-fips-pollen-options` | complete | Android APK manifest/static config exposes FIPS and Pollen; AVD WebView proof shows both visible; focused 37/37; `npm test` 223/223; e2e; changed-code slop clean |
| 2026-07-06 | `260706-v15-release-readback` | complete | `v0.1.5` release assets, GHCR target images, authenticated readback, and Docker smoke passed; anonymous GHCR still returns `unauthorized` |
| 2026-07-06 | `260706-ios-signed-device-uat-harness` | complete | Signed iOS device-install harness added; focused tests prove macOS/device/signing guardrails; real macOS hardware pass remains open |
| 2026-07-06 | `260706-ios-signed-device-launch-proof` | complete | Signed iOS device harness now installs and launches through `devicectl`; focused tests and runbook guards pass; real macOS hardware pass remains open |
| 2026-07-06 | `260706-ios-share-inbox-bridge` | complete | iOS native-source share extension stages files into App Group and containing app exposes `globalThis.meshdropShareInbox`; focused 6/6; `npm test` 229/229; changed-code slop clean; device share-transfer UAT remains open |
| 2026-07-06 | `260706-ios-share-inbox-web-consume` | complete | Web app consumes native share-inbox files into share mode; focused 3/3; `npm test` 231/231; changed-code slop clean; device share-transfer UAT remains open |
| 2026-07-06 | `260706-external-uat-finishline-verifier` | complete | Consolidated external UAT verifier added; focused 5/5; expected `npm run test:external-uat -- v0.1.5` blocker output; `npm test` 235/235; changed-code slop clean; full-repo slop baseline still failing outside touched files |
| 2026-07-06 | `260706-android-native-fips-pollen-backend` | complete | Installed Android APK loopback serves FIPS status and Pollen upload/download; WebView capability/transfer smokes pass; Rust FIPS core and Pollen WASM/pln remain explicit gaps |
| 2026-07-06 | `260706-android-native-core-tool-hooks` | complete | Android native-source/APK can package per-ABI `fips`, `fipsctl`, and `pln` tools and delegate backend calls when present; default smoke still lacks Android Rust FIPS and Android pln binaries |
| 2026-07-06 | `260706-android-pln-proof-and-fips-launch` | complete | Installed Android APK starts packaged `pln up --port 0` and WebView Pollen upload/download passes through `android-native-pln`; FIPS launch plumbing added, but Android Rust FIPS build remains blocked upstream |
| 2026-07-06 | `260706-android-rust-fips-core-proof` | complete | Release-built Android `fips`/`fipsctl` package into installed APK; `npm run test:android-fips-pollen` reports `android-native-fipsctl` with `rustCore=true`; changed-code slop clean; full-repo slop baseline remains failing outside touched files |
| 2026-07-06 | `260706-ux-network-postures` | complete | Shared network posture UI, Instance/Pollen badge counts, honest same-instance discovery wording, route grouping, privacy selector, private payload encryption for direct/Hashtree/Pollen, and federated FIPS/Pollen host-ICE browser proof; `npm test` 242/242; e2e and Docker smokes pass; slop baseline remains policy-failing |
| 2026-07-06 | `260706-ux-toggle-groups` | complete | Shared header groups protocol controls as Identity, Network, and Storage with visible labels; focused 29/29; Playwright desktop/mobile visual proof; `npm test` 243/243; e2e and Docker smokes pass; full-repo slop baseline remains policy-failing |
| 2026-07-06 | `260706-n77-hide-the-legacy-relay-webrtc-header-togg` | complete | Visible header controls are round icon-only: Identity Nostr, Network Instance/FIPS/Pollen, Storage Blossom/Hashtree; no group words/protocol words; legacy relay anchor is outside header and not visible; hidden Relay discovery autostarts without restoring the visible switch and keeps stored follow recipients when relay contact-list lookup is missing; Pollen badge shows `0`; `npm test` 248/248; e2e includes Nostr/WebRTC transfer proof; Docker smoke includes two-host Nostr WebRTC transfer; localhost:3000 Docker image `sha256:85a91444da5e0ff3a8a2fa4702d8894ffb90d85fd53a02c1f7370d1eb83990dc`; Playwright proves hidden relay active, public relay socket observed, no header clipping; changed-code slop clean; full-repo slop baseline remains policy-failing |
| 2026-07-06 | `260706-nostr-label-peer-crypto` | complete | Relay route text renamed to Nostr; one-bubble same-npub grouping retains Instance/Nostr badges; Private disables and Unencrypted defaults when Web Crypto is unavailable; relay settings prefill/save from current NIP-65 relays again; focused 29/29 plus relay focused 20/20; `npm test` 253/253; e2e and Docker transfer smokes pass; localhost:3000 browser proof passes; full-repo slop baseline still exits 1 |
| 2026-07-06 | `260706-rdw-make-docker-fips-self-contained-and-port` | complete | Docker image installs upstream FIPS v0.4.0 `fips`/`fipsctl` with checksum verification; compose no longer bind-mounts host FIPS binaries; live compose logs show `Starting FIPS daemon with /etc/fips/fips.yaml`; `/fips/status` returns available; `npm run test:docker`; `npm test` 249/249; changed-code slop clean; full-repo slop baseline remains policy-failing |
| 2026-07-06 | `260706-docker-fips-default-control-socket` | complete | Compose runs without `FIPS_CONTROL_SOCKET`; server defaults to `/run/fips/control.sock`; live compose rebuilt/restarted; `/fips/status` returned `available: true`; `npm test` 249/249; `npm run test:docker`; changed-code slop clean; full-repo slop baseline remains policy-failing |
| 2026-07-06 | `260706-s84-fix-client-side-relay-configuration-defa` | complete | Browser Relays tab shows non-empty bootstrap/WebRTC/inbox/outbox defaults; compose renders admin pubkey `e771af0b05c8e95fcdf6feb3500544d2fb1ccd384788e9f490bb3ee28e`; focused tests; `npm test` 250/250; e2e; Docker smoke; changed-code slop clean; full-repo slop baseline remains policy-failing |
| 2026-07-06 | `260706-v2r-fix-meshdrop-fips-pollen-cross-device-di` | complete | FIPS/Pollen federation advertises `kind:20385` Nostr discovery; generic FIPS peers are route candidates only, not `http://[peer]:3000` MeshDrop probes; visible Nostr WebRTC toggle restored with old icon and footer badge says Nostr; focused 95/95; `npm test` 265/265; e2e proves Nostr WebRTC, FIPS route-candidate-only, and federated Pollen WebRTC; Docker smoke passed; CI follow-up fixed stale shared-room Nostr smoke selection, fake FIPS socket reset, and per-scenario federated app cleanup; `npm run test:target-artifacts`, `npm run test:e2e`, and `npm run test:spa-artifact` pass; changed-code slop exits 0 with existing size/function warnings; full slop baseline remains policy-failing |
| 2026-07-07 | `260707-ctl-clearnet-route-control-visibility` | complete | Clearnet file-route control stays visible for direct Nostr-signaled WebRTC without same-instance discovery; footer badges and FIPS/Pollen copy distinguish discovery/signaling from ICE data path; WebRTC-over-FIPS/Pollen relay requirements documented; focused route/control/copy tests and `npm test` pass |
| 2026-07-07 | `260707-smoke-clearnet-route-visibility` | complete | SPA and target artifact smoke expectations updated for visible Clearnet file-route exclusion in backend-free Nostr WebRTC runtimes; e2e Pollen scenario label updated; `npm run test:spa-artifact`, `npm run test:target-artifacts`, `npm run test:e2e`, `npm run test:docker`, and `npm test` pass |
| 2026-07-07 | `260707-4x8-implement-privacy-preserving-two-stage-n` | complete | Public Nostr presence minimized; FIPS/Pollen route descriptors exchanged on-demand through NIP-44 after direct route failure; focused route/privacy tests, `npm test`, e2e, Docker smoke, diff check, and changed-code slop pass; full-repo slop baseline remains policy-failing |
| 2026-07-07 | `260707-clearnet-exclusion-private-routes` | complete | Clearnet file-route exclusion keeps Nostr discovery as a private FIPS/Pollen route descriptor source without opening direct Nostr WebRTC; focused route/control tests, `npm test` 293/293, e2e, Docker smoke, diff check, and changed-code slop pass; full-repo slop baseline remains policy-failing |
| 2026-07-07 | `260707-6f1-separate-instance-assisted-webrtc-from-c` | complete | Instance toggle now gates only same-instance `ip`; new Clearnet toggle gates direct Nostr WebRTC only; Nostr signaling toggle preserves existing RTC routes; focused 103/103, `npm test` 299/299, e2e, Docker smoke, diff check, and changed-code slop pass; full-repo slop baseline remains policy-failing |
| 2026-07-07 | `260707-prh-harden-private-route-presence` | complete | WOT presence uses one `meshdrop-webrtc` capability and omits public route/private fields; plaintext route detail events fail closed; focused 104/104, `npm test` 300/300, e2e, Docker smoke, diff check, and changed-code slop exit 0 |

## Active Quick Task

- None.

---
*Initialized: 2026-07-04 from goal objective.*

## Current Position

Phase: 8 Route Attempts UX
Plan: 08-01 implemented locally
Status: Local verification complete; PR/CI/merge pending
Last activity: 2026-07-07 — Route-attempt UX implementation, focused tests, broad tests, e2e, and visual probe added
