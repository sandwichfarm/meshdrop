# Index Validation Log Baseline Summary

## Changed

- Replaced three validation-failure `console.error` calls in `server/index.js` with the existing explicit stderr writer.
- Preserved message text, validation branches, and exit status for invalid IPv6 localization and signaling-server settings.

## Verification

- `node --check server/index.js` -> passed.
- `IPV6_LOCALIZE=9 node server/index.js` -> exited 1 with expected IPv6 validation message.
- `SIGNALING_SERVER=https://example.com node server/index.js` -> exited 1 with expected signaling URL validation message.
- `SIGNALING_SERVER=example.com WS_FALLBACK=true node server/index.js` -> exited 1 with expected signaling conflict validation message.
- `npm test` -> 200 passed.
- `git diff --check` -> passed.
- `npx --yes aislop scan --changes .` -> clean, 100/100, no issues.
- `npx --yes aislop scan .` -> exit 1, 0 errors, 58 warnings.

## Remaining Baseline

- Full-repo `aislop` still reports vendored noble-ciphers unused expressions, large files, duplicate blocks, one hardcoded URL, TODO/stub warnings, long functions, and one unused parameter in `public/scripts/network.js`.
- This slice intentionally leaves WebSocket/federation warning paths and non-overlapping baseline warnings for separate PRs.
