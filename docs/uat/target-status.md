# Target UAT Status

This ledger prevents release or UAT notes from overstating platform support.

| Target | Status | Current proof | Remaining proof before complete |
|--------|--------|---------------|---------------------------------|
| SPA | Chromium/Firefox/WebKit backend-free transfer smoke exists; Chromium/Firefox public relay UAT exists | `SPA browser matrix` CI job; `npm run test:spa-artifact`; manual run `28713488687` public relay jobs against `wss://bucket.coracle.social`; manual run `28716511864` WebKit transfer UAT | None recorded for current SPA runbook |
| Docker | Container admin, local, Pollen, deterministic two-host relay, public relay two-host UAT, and deployed-admin UAT exists | `npm run test:docker`; `npm run test:docker:two-host`; `npm run test:docker:admin`; manual run `28715209725` Docker public relay UAT against `wss://bucket.coracle.social` | None recorded for Docker |
| Start9 | Generated package environment transfer smoke exists; real StartOS device UAT open | `npm run test:start9-package` proves package build, generated StartOS env readback, `/config` target `start9`, local WebRTC transfer, and Pollen WebRTC transfer; isolated `start-cli 0.4.0-beta.10` plus generated `bin/tar2sqfs` fallback produced `meshdrop_x86_64.s9pk` with SHA-256 `4a166eb17d1b51e09f38b63980dcf3a05acb1b889069d00bcc34ff4c043e91a1` | Real StartOS device install from UI and device transfer UAT |
| Umbrel | Rendered package compose transfer smoke exists; real Umbrel node UAT open | `npm run test:umbrel-package` proves package build, rendered compose boot, `/config` target `umbrel`, local WebRTC transfer, and Pollen WebRTC transfer | Real Umbrel node install from UI and device transfer UAT |
| Desktop Native | Source artifact transfer smoke and Linux native shell build exist; native transfer UAT open | `npm run build:desktop`; `npm run build:desktop:native`; `node --test test/desktop-package.test.js` proves source artifact shape, Linux GTK/WebKit shell compilation, and native shell config readback; `npm run test:target-artifacts` proves desktop runtime readback and Nostr WebRTC transfer from the generated source artifact | Signed installer and native desktop transfer UAT |
| iOS | Source artifact transfer smoke exists; native shell not built | `npm run build:ios`; `node --test test/mobile-package.test.js`; `npm run test:target-artifacts` proves iOS runtime readback and Nostr WebRTC transfer from the generated source artifact | Native iOS shell build, app package, file-picker/share-sheet integration, Bluetooth negotiation, and native mobile transfer UAT |
| Android | Source artifact transfer smoke exists; native shell not built | `npm run build:android`; `node --test test/mobile-package.test.js`; `npm run test:target-artifacts` proves Android runtime readback and Nostr WebRTC transfer from the generated source artifact | Native Android shell build, app package, file-picker/share-sheet integration, Bluetooth negotiation, and native mobile transfer UAT |
| Release Images | `v0.1.2` release assets, target images, authenticated readback, and Docker smoke verified; anonymous GHCR visibility blocks final release proof | Release run `28721154277`; release assets include SPA, Docker-adjacent source, Start9, Umbrel, Desktop Native, iOS, and Android tarballs; GHCR target image jobs passed for `standalone`, `start9`, and `umbrel`; release readback confirmed authenticated multi-arch manifests, pulled metadata, and Docker smoke; `npm run verify:ghcr-anonymous -- v0.1.2` with a temporary empty Docker config returns GHCR `unauthorized` | Make `ghcr.io/sandwichfarm/meshdrop` public or prove anonymous GHCR manifest readback on the next `v0.*.*` tag |

## Rules

- Do not call a target complete unless its build artifact exists, it has a UAT runbook, and the runbook has current passing evidence.
- Do not use unit tests alone as proof for file-transfer paths.
- For WebRTC support, initiate a real transfer between two peers before claiming the path works.
- For release targets, read back the GitHub release and GHCR tags after the workflow runs.
