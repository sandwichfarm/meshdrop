# Docker Transfer Timeout Fix

## Goal

Restore master Docker smoke by making the Docker browser-transfer receive wait honor its intended timeout.

## Scope

- Fix the Playwright `waitForFunction` call shape in `scripts/docker-browser-transfer-smoke.mjs`.
- Add route-specific failure diagnostics for Docker browser-transfer receive timeouts.
- Add a focused guard so the timeout options are passed as Playwright options, not as the page argument.

## Out Of Scope

- Changing Docker runtime behavior.
- Changing transfer protocol behavior.
- Retrying or weakening the Docker transfer assertion.

## Validation

- Focused smoke-script test.
- Local Docker smoke with browser transfer proof.
- Full unit suite.
- Diff and slop gates.
- PR and master CI readback.
