# Target UAT Status

This ledger prevents release or UAT notes from overstating platform support.

| Target | Status | Current proof | Remaining proof before complete |
|--------|--------|---------------|---------------------------------|
| SPA | Chromium/Firefox/WebKit backend-free transfer smoke exists; Chromium/Firefox public relay UAT exists | `SPA browser matrix` CI job; `npm run test:spa-artifact`; manual run `28713488687` public relay jobs against `wss://bucket.coracle.social`; manual run `28716511864` WebKit transfer UAT | None recorded for current SPA runbook |
| Docker | Container admin, local, Pollen, deterministic two-host relay, public relay two-host UAT, and deployed-admin UAT exists | `npm run test:docker`; `npm run test:docker:two-host`; `npm run test:docker:admin`; manual run `28715209725` Docker public relay UAT against `wss://bucket.coracle.social` | None recorded for Docker |
| Start9 | x86_64 `.s9pk` package build exists | `npm run build:start9`; `node --test test/start9-package.test.js`; generated source `npm run check` and `npm run build`; isolated `start-cli 0.4.0-beta.10` plus generated `bin/tar2sqfs` fallback produced `meshdrop_x86_64.s9pk` with SHA-256 `4a166eb17d1b51e09f38b63980dcf3a05acb1b889069d00bcc34ff4c043e91a1` | StartOS device install and transfer UAT |
| Umbrel | Package artifact smoke exists | `npm run build:umbrel`; package test | Umbrel device install and transfer UAT |
| Desktop Native | Source artifact transfer smoke exists; native shell not built | `npm run build:desktop`; `node --test test/desktop-package.test.js`; `npm run test:target-artifacts` proves desktop runtime readback and Nostr WebRTC transfer from the generated source artifact | Native shell build, installer/binary, and native desktop transfer UAT |
| iOS | Source artifact transfer smoke exists; native shell not built | `npm run build:ios`; `node --test test/mobile-package.test.js`; `npm run test:target-artifacts` proves iOS runtime readback and Nostr WebRTC transfer from the generated source artifact | Native iOS shell build, app package, file-picker/share-sheet integration, Bluetooth negotiation, and native mobile transfer UAT |
| Android | Source artifact transfer smoke exists; native shell not built | `npm run build:android`; `node --test test/mobile-package.test.js`; `npm run test:target-artifacts` proves Android runtime readback and Nostr WebRTC transfer from the generated source artifact | Native Android shell build, app package, file-picker/share-sheet integration, Bluetooth negotiation, and native mobile transfer UAT |
| Release Images | `v0.1.0` authenticated readback verified | Release run `28711136765`; release verification run `28711452622`; local anonymous `docker manifest inspect ghcr.io/sandwichfarm/meshdrop:v0.1.0-start9` returned `denied` | Anonymous GHCR manifest readback and full release verification for each new `v0.*.*` tag |

## Rules

- Do not call a target complete unless its build artifact exists, it has a UAT runbook, and the runbook has current passing evidence.
- Do not use unit tests alone as proof for file-transfer paths.
- For WebRTC support, initiate a real transfer between two peers before claiming the path works.
- For release targets, read back the GitHub release and GHCR tags after the workflow runs.
