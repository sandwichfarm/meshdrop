# Remove unsafe UI innerHTML security findings

## Result

Replaced the received-text and QR-code HTML injection paths with DOM construction helpers. Received text now renders links through text and anchor nodes, and QR markup is parsed as SVG before it is imported into the document.

## Evidence

- `node --check public/scripts/ui.js && node --check public/scripts/ui-main.js && node --check public/scripts/persistent-storage.js && node --check public/scripts/browser-tabs-connector.js && node --check public/scripts/util.js`
- `node --test test/ui-safe-dom.test.js test/peer-availability-protocol.test.js`
- `npm run test:e2e`
- `npm test`
- `git diff --check`
- `npx --yes aislop scan --changes .`
- `npx --yes aislop scan .`

## Known Gaps

Full-repo `aislop` still fails on existing baseline lint/style/AI-slop findings outside this slice, but the full scan now reports zero security issues. Changed-code scan reports no lint, security, or AI-slop issues and only inherited style warnings for large/duplicate existing files.
