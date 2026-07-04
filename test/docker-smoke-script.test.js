import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dockerSmoke = fs.readFileSync(new URL("../scripts/docker-smoke.mjs", import.meta.url), "utf8");
const dockerTransfer = fs.readFileSync(
    new URL("../scripts/docker-browser-transfer-smoke.mjs", import.meta.url),
    "utf8"
);
const ciWorkflow = fs.readFileSync(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");

test("Docker smoke initiates browser transfer proof against the built container", () => {
    assert.match(dockerSmoke, /MESHDROP_DOCKER_TRANSFER_BASE_URL/);
    assert.match(dockerSmoke, /scripts\/docker-browser-transfer-smoke\.mjs/);
    assert.match(dockerTransfer, /select-files-transport/);
    assert.match(dockerTransfer, /docker-local-webrtc/);
    assert.match(ciWorkflow, /Install Chromium[\s\S]*npx playwright install --with-deps chromium/);
});
