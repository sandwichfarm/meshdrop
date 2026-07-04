# Target UAT Status

This ledger prevents release or UAT notes from overstating platform support.

| Target | Status | Current proof | Remaining proof before complete |
|--------|--------|---------------|---------------------------------|
| SPA | Chromium/Firefox backend-free transfer smoke exists; WebKit runtime smoke exists | `SPA browser matrix` CI job; `npm run test:spa-artifact` | WebKit transfer UAT; public relay UAT |
| Docker | Container admin, local, and Pollen smoke exists | `npm run test:docker` | Real deployed-admin UAT and two-host relay UAT |
| Start9 | Package source smoke exists | `npm run build:start9`; package test | `.s9pk` build, device install, and transfer UAT |
| Umbrel | Package artifact smoke exists | `npm run build:umbrel`; package test | Umbrel device install and transfer UAT |
| Desktop Native | Not implemented | None | Native shell selection, build target, runtime capability manifest, and transfer UAT |
| iOS | Not implemented | None | Mobile runtime design, build target, platform transport negotiation, and transfer UAT |
| Android | Not implemented | None | Mobile runtime design, build target, platform transport negotiation, and transfer UAT |
| Release Images | `v0.1.0` verified | Release run `28711136765`; release verification run `28711452622` | Repeat release verification for each new `v0.*.*` tag |

## Rules

- Do not call a target complete unless its build artifact exists, it has a UAT runbook, and the runbook has current passing evidence.
- Do not use unit tests alone as proof for file-transfer paths.
- For WebRTC support, initiate a real transfer between two peers before claiming the path works.
- For release targets, read back the GitHub release and GHCR tags after the workflow runs.
