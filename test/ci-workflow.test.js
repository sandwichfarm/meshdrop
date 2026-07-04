import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ciWorkflow = fs.readFileSync(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");

test("CI runs desktop and mobile target artifact transfer smoke", () => {
    assert.match(ciWorkflow, /Install desktop native shell dependencies/);
    assert.match(ciWorkflow, /libgtk-4-dev libwebkitgtk-6\.0-dev/);
    assert.match(ciWorkflow, /target-artifacts:/);
    assert.match(ciWorkflow, /name: Target artifact transfer smoke/);
    assert.match(ciWorkflow, /needs: unit/);
    assert.match(ciWorkflow, /npx playwright install --with-deps chromium/);
    assert.match(ciWorkflow, /npm run test:target-artifacts/);
});
