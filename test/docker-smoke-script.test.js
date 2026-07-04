import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dockerSmoke = fs.readFileSync(new URL("../scripts/docker-smoke.mjs", import.meta.url), "utf8");
const dockerTransfer = fs.readFileSync(
    new URL("../scripts/docker-browser-transfer-smoke.mjs", import.meta.url),
    "utf8"
);
const dockerTwoHostRelay = fs.readFileSync(
    new URL("../scripts/docker-two-host-relay-smoke.mjs", import.meta.url),
    "utf8"
);
const e2eSmoke = fs.readFileSync(new URL("../scripts/e2e-smoke.mjs", import.meta.url), "utf8");
const ciWorkflow = fs.readFileSync(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");
const packageJson = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("Docker smoke initiates browser transfer proof against the built container", () => {
    assert.match(dockerSmoke, /MESHDROP_DOCKER_TRANSFER_BASE_URL/);
    assert.match(dockerSmoke, /scripts\/docker-browser-transfer-smoke\.mjs/);
    assert.match(dockerTransfer, /select-files-transport/);
    assert.match(dockerTransfer, /docker-local-webrtc/);
    assert.match(dockerTransfer, /docker-pollen-webrtc/);
    assert.match(dockerTransfer, /meshdropPollenTransfer\.enable/);
    assert.match(dockerTransfer, /undefined, \{timeout: 45000\}/);
    assert.match(dockerSmoke, /MESHDROP_DOCKER_ADMIN_SECRET_KEY/);
    assert.match(dockerSmoke, /scripts\/fips-control-smoke-mock\.mjs/);
    assert.match(dockerSmoke, /scripts\/docker-two-host-relay-smoke\.mjs/);
    assert.match(dockerTransfer, /docker-admin-settings/);
    assert.match(dockerTransfer, /settings\/fips\/peers/);
    assert.match(dockerTwoHostRelay, /docker-two-host-nostr-webrtc/);
    assert.match(dockerTwoHostRelay, /docker-public-relay-two-host-webrtc/);
    assert.match(dockerTwoHostRelay, /MESHDROP_DOCKER_PUBLIC_RELAY_URLS/);
    assert.match(dockerTwoHostRelay, /MESHDROP_DOCKER_PUBLIC_RELAY_ATTEMPTS/);
    assert.match(dockerTwoHostRelay, /file-transfer-accepted/);
    assert.match(dockerTwoHostRelay, /files-sent/);
    assert.match(dockerTwoHostRelay, /waitForOpenRtcPeer/);
    assert.match(dockerTwoHostRelay, /meshdrop-proof-icon\.svg between two Docker instances/);
    assert.match(packageJson, /"test:docker:two-host": "node scripts\/docker-two-host-relay-smoke\.mjs"/);
    assert.match(e2eSmoke, /retryScenario\(\s*"federated-fips-webrtc"/);
    assert.match(e2eSmoke, /waitForDirectRoute\(pageA, peerId, "fips"\)/);
    assert.match(ciWorkflow, /Install Chromium[\s\S]*npx playwright install --with-deps chromium/);
    assert.match(ciWorkflow, /docker_public_relay_urls:/);
    assert.match(ciWorkflow, /docker-public-relay-uat:/);
    assert.match(ciWorkflow, /MESHDROP_DOCKER_PUBLIC_RELAY_URLS: \$\{\{ inputs\.docker_public_relay_urls \}\}/);
});
