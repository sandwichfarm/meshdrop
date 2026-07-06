import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dockerSmoke = fs.readFileSync(new URL("../scripts/docker-smoke.mjs", import.meta.url), "utf8");
const dockerfile = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const dockerCompose = fs.readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");
const startWithFips = fs.readFileSync(new URL("../scripts/start-with-fips.sh", import.meta.url), "utf8");
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
    assert.match(dockerTransfer, /MESHDROP_DOCKER_TRANSFER_PROOF_PREFIX \|\| "docker"/);
    assert.match(dockerTransfer, /`\$\{proofPrefix\}-local-webrtc`/);
    assert.match(dockerTransfer, /`\$\{proofPrefix\}-pollen-webrtc`/);
    assert.match(dockerTransfer, /meshdrop-\$\{options\.name\}-proof\.txt/);
    assert.match(dockerTransfer, /scenario=\$\{options\.name\}/);
    assert.match(dockerTransfer, /transport=\$\{options\.transportId\}/);
    assert.match(dockerTransfer, /meshdropPollenTransfer\.enable/);
    assert.match(dockerTransfer, /const transferTimeoutMs = 45000/);
    assert.match(dockerTransfer, /\{timeout: transferTimeoutMs\}/);
    assert.match(dockerTransfer, /setDefaultTimeout\(pageReadyTimeoutMs\)/);
    assert.match(dockerTransfer, /setDefaultNavigationTimeout\(pageReadyTimeoutMs\)/);
    assert.match(dockerTransfer, /Docker browser transfer smoke start:/);
    assert.match(dockerTransfer, /method\.id === "browser-extension"/);
    assert.match(dockerSmoke, /\[docker-smoke\] start:/);
    assert.match(dockerSmoke, /timeoutMs: 8 \* minute/);
    assert.match(dockerSmoke, /MESHDROP_DOCKER_ADMIN_SECRET_KEY/);
    assert.match(dockerSmoke, /scripts\/fips-control-smoke-mock\.mjs/);
    assert.match(dockerSmoke, /scripts\/docker-two-host-relay-smoke\.mjs/);
    assert.match(dockerTransfer, /docker-admin-settings/);
    assert.match(dockerTransfer, /settings\/fips\/peers/);
    assert.match(packageJson, /"test:docker:admin": "node scripts\/docker-compose-admin-uat\.mjs"/);
    assert.equal(fs.existsSync(new URL("../scripts/docker-compose-admin-uat.mjs", import.meta.url)), true);
    assert.match(dockerTwoHostRelay, /docker-two-host-nostr-webrtc/);
    assert.match(dockerTwoHostRelay, /docker-public-relay-two-host-webrtc/);
    assert.match(dockerTwoHostRelay, /MESHDROP_DOCKER_PUBLIC_RELAY_URLS/);
    assert.match(dockerTwoHostRelay, /MESHDROP_DOCKER_PUBLIC_RELAY_ATTEMPTS/);
    assert.match(dockerTwoHostRelay, /file-transfer-accepted/);
    assert.match(dockerTwoHostRelay, /files-sent/);
    assert.match(dockerTwoHostRelay, /waitForOpenRtcPeer/);
    assert.match(dockerTwoHostRelay, /meshdrop-\$\{proofName\}-proof\.txt/);
    assert.match(dockerTwoHostRelay, /scenario=\$\{proofName\}/);
    assert.match(dockerTwoHostRelay, /relayCount=\$\{relayUrls\.length\}/);
    assert.match(dockerTwoHostRelay, /between two Docker instances/);
    assert.match(packageJson, /"test:docker:two-host": "node scripts\/docker-two-host-relay-smoke\.mjs"/);
    assert.match(e2eSmoke, /retryScenario\(\s*"federated-fips-webrtc"/);
    assert.match(e2eSmoke, /waitForDirectRoute\(pageA, peerId, "fips"\)/);
    assert.match(ciWorkflow, /Install Chromium[\s\S]*npx playwright install --with-deps chromium/);
    assert.match(ciWorkflow, /docker_public_relay_urls:/);
    assert.match(ciWorkflow, /docker-public-relay-uat:/);
    assert.match(ciWorkflow, /MESHDROP_DOCKER_PUBLIC_RELAY_URLS: \$\{\{ inputs\.docker_public_relay_urls \}\}/);
});

test("Docker packages FIPS binaries instead of mounting host tools", () => {
    assert.match(dockerfile, /ARG FIPS_VERSION=v0\.4\.0/);
    assert.match(dockerfile, /checksums-linux\.txt/);
    assert.match(dockerfile, /unsupported fips arch/);
    assert.match(dockerfile, /fips-\$\{version\}-linux-\$\{fips_arch\}\.tar\.gz/);
    assert.match(dockerfile, /\/usr\/local\/bin\/fips/);
    assert.match(dockerfile, /\/usr\/local\/bin\/fipsctl/);
    assert.match(dockerfile, /fips --version/);
    assert.match(dockerfile, /fipsctl --version/);

    assert.doesNotMatch(dockerCompose, /\/usr\/bin\/fips/);
    assert.doesNotMatch(dockerCompose, /\/usr\/bin\/fipsctl/);
    assert.match(dockerCompose, /\.\/fips\.yaml:\/etc\/fips\/fips\.yaml:ro/);
    assert.match(dockerCompose, /\/dev\/net\/tun:\/dev\/net\/tun/);
    assert.match(dockerCompose, /NET_ADMIN/);

    assert.match(startWithFips, /command -v fipsctl/);
    assert.match(startWithFips, /Starting FIPS daemon with/);
    assert.match(startWithFips, /FIPS daemon not started: fips or fipsctl binary or config file is missing/);

    assert.match(dockerSmoke, /assertFipsBinariesInstalled/);
    assert.match(dockerSmoke, /assertFipsStartupLogs/);
});
