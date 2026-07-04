import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readDoc = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("target UAT runbooks cover shipped build surfaces without overclaiming", () => {
    const requiredDocs = [
        "docs/uat/spa.md",
        "docs/uat/docker.md",
        "docs/uat/start9.md",
        "docs/uat/umbrel.md",
        "docs/uat/release-target-images.md",
        "docs/uat/target-status.md",
    ];

    for (const path of requiredDocs) {
        assert.equal(fs.existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`);
    }

    const spa = readDoc("docs/uat/spa.md");
    assert.match(spa, /PLAYWRIGHT_BROWSER=chromium/);
    assert.match(spa, /PLAYWRIGHT_BROWSER=firefox/);
    assert.match(spa, /PLAYWRIGHT_BROWSER=webkit/);
    assert.match(spa, /SPA browser matrix/);
    assert.match(spa, /Chromium and Firefox also connect two Nostr identities/);
    assert.match(spa, /WebKit currently proves packaged runtime compatibility\s+only/);
    assert.match(spa, /MESHDROP_SPA_WEBKIT_TRANSFER=1/);
    assert.match(spa, /Proof backend-free-spa-nostr-webrtc:webkit/);
    assert.match(spa, /MESHDROP_SPA_PUBLIC_RELAY_URLS=wss:\/\/bucket\.coracle\.social/);
    assert.match(spa, /Proof public-spa-nostr-webrtc:<browser>/);
    assert.match(spa, /manual-only `SPA public relay UAT` job runs Chromium and Firefox/);
    assert.match(spa, /manual CI run `28713488687` passed the Chromium and Firefox/);
    assert.match(spa, /No current WebKit transfer proof is recorded/);

    assert.match(readDoc("docs/uat/docker.md"), /npm run test:docker/);
    assert.match(readDoc("docs/uat/docker.md"), /npm run test:docker:two-host/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_ADMIN_NPUB/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_DISCOVERY_NPUBS/);
    assert.match(readDoc("docs/uat/docker.md"), /Proof docker-two-host-nostr-webrtc/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_DOCKER_PUBLIC_RELAY_URLS=wss:\/\/bucket\.coracle\.social/);
    assert.match(readDoc("docs/uat/docker.md"), /MESHDROP_DOCKER_PUBLIC_RELAY_ATTEMPTS/);
    assert.match(readDoc("docs/uat/docker.md"), /Proof docker-public-relay-two-host-webrtc/);

    const start9 = readDoc("docs/uat/start9.md");
    assert.match(start9, /npm run build:start9/);
    assert.match(start9, /MESHDROP_TARGET=start9/);
    assert.match(start9, /MESHDROP_DISCOVERY_NPUBS/);
    assert.match(start9, /MESHDROP_ADMIN_NPUB/);
    assert.match(start9, /\.s9pk/);
    assert.match(start9, /Not Proven/);

    const umbrel = readDoc("docs/uat/umbrel.md");
    assert.match(umbrel, /npm run build:umbrel/);
    assert.match(umbrel, /MESHDROP_TARGET=umbrel/);
    assert.match(umbrel, /MESHDROP_DISCOVERY_NPUBS/);
    assert.match(umbrel, /MESHDROP_ADMIN_NPUB/);
    assert.match(umbrel, /Not Proven/);

    const releaseTargets = readDoc("docs/uat/release-target-images.md");
    for (const target of ["standalone", "start9", "umbrel"]) {
        assert.match(releaseTargets, new RegExp(`MESHDROP_TARGET=${target}`));
        assert.match(releaseTargets, new RegExp(`:${target}`));
    }
    assert.match(releaseTargets, /multi-architecture manifests for `linux\/amd64` and `linux\/arm64`/);
    assert.match(releaseTargets, /docker buildx imagetools inspect/);
    assert.match(releaseTargets, /release-verify\.yml/);
    assert.match(releaseTargets, /readback runs with GitHub Actions package permissions/);
    assert.match(releaseTargets, /v0\.1\.0` is proven by release run `28711136765`/);
    assert.match(releaseTargets, /release verification workflow: https:\/\/github\.com\/sandwichfarm\/meshdrop\/actions\/runs\/28711452622/i);
    assert.match(releaseTargets, /meshdrop-spa-0\.1\.0\.tar\.gz/);
    assert.match(releaseTargets, /v0\.1\.0-standalone/);
    assert.match(releaseTargets, /Start9 source tarball/);
    assert.match(releaseTargets, /Umbrel package tarball/);
    assert.match(releaseTargets, /Not proven/);

    const targetStatus = readDoc("docs/uat/target-status.md");
    for (const target of ["SPA", "Docker", "Start9", "Umbrel", "Desktop Native", "iOS", "Android", "Release Images"]) {
        assert.match(targetStatus, new RegExp(`\\| ${target} \\|`));
    }
    assert.match(targetStatus, /\| Release Images \| `v0\.1\.0` verified \|/);
    assert.match(
        targetStatus,
        /\| SPA \| Chromium\/Firefox backend-free transfer smoke exists; WebKit runtime smoke exists; Chromium\/Firefox public relay UAT exists \|/
    );
    assert.match(targetStatus, /manual run `28713488687` public relay jobs/);
    assert.match(targetStatus, /WebKit transfer UAT via `MESHDROP_SPA_WEBKIT_TRANSFER=1`/);
    assert.match(targetStatus, /deterministic two-host relay smoke exists/);
    assert.match(targetStatus, /public relay two-host UAT/);
    assert.match(targetStatus, /\| Desktop Native \| Not implemented \|/);
    assert.match(targetStatus, /\| iOS \| Not implemented \|/);
    assert.match(targetStatus, /\| Android \| Not implemented \|/);
});
