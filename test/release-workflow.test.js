import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const releaseWorkflow = fs.readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const releaseVerifyWorkflowUrl = new URL("../.github/workflows/release-verify.yml", import.meta.url);
const duplicateGhcrWorkflow = new URL("../.github/workflows/github-image.yml", import.meta.url);
const dockerfile = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const packageJson = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");
const anonymousReadbackScript = fs.readFileSync(
    new URL("../scripts/ghcr-anonymous-readback.mjs", import.meta.url),
    "utf8"
);

test("release workflow publishes GHCR images for alpha target packages", () => {
    assert.match(releaseWorkflow, /permissions:\n  contents: write\n  packages: write/);
    assert.match(releaseWorkflow, /container-images:/);
    assert.match(releaseWorkflow, /needs: release/);
    assert.match(releaseWorkflow, /target: \[standalone, start9, umbrel\]/);
    assert.match(releaseWorkflow, /docker login ghcr\.io/);
    assert.match(releaseWorkflow, /ghcr\.io\/\$\{GITHUB_REPOSITORY,,\}/);
    assert.match(releaseWorkflow, /docker\/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4\.2\.0/);
    assert.match(releaseWorkflow, /platforms: arm64/);
    assert.match(releaseWorkflow, /docker\/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c # v4\.2\.0/);
    assert.match(releaseWorkflow, /docker\/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7\.3\.0/);
    assert.match(releaseWorkflow, /platforms: linux\/amd64,linux\/arm64/);
    assert.match(releaseWorkflow, /push: true/);
    assert.match(releaseWorkflow, /MESHDROP_TARGET=\$\{\{ steps\.image\.outputs\.target \}\}/);
    assert.match(releaseWorkflow, /MESH_DROP_COMMIT=\$\{\{ github\.sha \}\}/);
    assert.match(releaseWorkflow, /farm\.sandwich\.meshdrop\.target=\$\{\{ steps\.image\.outputs\.target \}\}/);
    assert.match(releaseWorkflow, /\$\{\{ steps\.image\.outputs\.image \}\}:\$\{\{ steps\.image\.outputs\.tag \}\}-\$\{\{ steps\.image\.outputs\.target \}\}/);
    assert.match(releaseWorkflow, /\$\{\{ steps\.image\.outputs\.image \}\}:\$\{\{ steps\.image\.outputs\.version \}\}-\$\{\{ steps\.image\.outputs\.target \}\}/);
    assert.match(releaseWorkflow, /npm run build:start9 -- --version "\$\{version\}"/);
    assert.match(releaseWorkflow, /--image "\$\{image\}:\$\{GITHUB_REF_NAME\}-start9"/);
    assert.match(releaseWorkflow, /npm run build:umbrel -- --version "\$\{version\}"/);
    assert.match(releaseWorkflow, /--image "\$\{image\}:\$\{GITHUB_REF_NAME\}-umbrel"/);
    assert.match(releaseWorkflow, /npm run build:desktop -- --version "\$\{version\}" --out-dir dist/);
    assert.match(releaseWorkflow, /npm run build:ios -- --version "\$\{version\}" --out-dir dist/);
    assert.match(releaseWorkflow, /npm run build:android -- --version "\$\{version\}" --out-dir dist/);
});

test("Dockerfile records the image target inside released containers", () => {
    assert.match(dockerfile, /ARG MESHDROP_TARGET=standalone/);
    assert.match(dockerfile, /ENV MESHDROP_TARGET="\$\{MESHDROP_TARGET\}"/);
    assert.match(dockerfile, /farm\.sandwich\.meshdrop\.target="\$\{MESHDROP_TARGET\}"/);
});

test("release tags use one workflow for GitHub release artifacts and GHCR images", () => {
    assert.equal(fs.existsSync(duplicateGhcrWorkflow), false);
});

test("release verification workflow reads back assets, manifests, and pulled standalone smoke", () => {
    assert.equal(fs.existsSync(releaseVerifyWorkflowUrl), true);

    const releaseVerifyWorkflow = fs.readFileSync(releaseVerifyWorkflowUrl, "utf8");
    assert.match(releaseVerifyWorkflow, /workflow_dispatch:/);
    assert.match(releaseVerifyWorkflow, /tag:/);
    assert.match(releaseVerifyWorkflow, /permissions:\n  contents: read\n  packages: read/);
    assert.match(releaseVerifyWorkflow, /ref: \$\{\{ inputs\.tag \}\}/);
    assert.match(releaseVerifyWorkflow, /gh release view "\$\{tag\}"/);
    assert.match(releaseVerifyWorkflow, /meshdrop-desktop-\$\{version\}\.tar\.gz/);
    assert.match(releaseVerifyWorkflow, /meshdrop-ios-\$\{version\}\.tar\.gz/);
    assert.match(releaseVerifyWorkflow, /meshdrop-android-\$\{version\}\.tar\.gz/);
    assert.match(releaseVerifyWorkflow, /docker buildx imagetools inspect "\$\{image\}"/);
    assert.match(releaseVerifyWorkflow, /Verify anonymous GHCR manifests/);
    assert.match(releaseVerifyWorkflow, /image_base="ghcr\.io\/\$\{GITHUB_REPOSITORY,,\}"/);
    assert.match(releaseVerifyWorkflow, /MESHDROP_GHCR_IMAGE_BASE="\$\{image_base\}"/);
    assert.match(releaseVerifyWorkflow, /npm run verify:ghcr-anonymous -- "\$\{tag\}"/);
    assert.doesNotMatch(releaseVerifyWorkflow, /Inspecting \$\{image\} without GHCR login/);
    assert.match(releaseVerifyWorkflow, /linux\/amd64/);
    assert.match(releaseVerifyWorkflow, /linux\/arm64/);
    assert.match(releaseVerifyWorkflow, /MESHDROP_DOCKER_IMAGE: ghcr\.io\/\$\{\{ github\.repository \}\}:\$\{\{ inputs\.tag \}\}-standalone/);
    assert.match(releaseVerifyWorkflow, /npm run test:docker/);
});

test("anonymous GHCR readback can run locally without mutating Docker login state", () => {
    assert.match(packageJson, /"verify:ghcr-anonymous": "node scripts\/ghcr-anonymous-readback\.mjs"/);
    assert.match(anonymousReadbackScript, /mkdtemp\(path\.join\(os\.tmpdir\(\), "meshdrop-ghcr-anon-"\)\)/);
    assert.match(anonymousReadbackScript, /env: \{DOCKER_CONFIG: dockerConfig\}/);
    assert.doesNotMatch(anonymousReadbackScript, /docker", \["logout"/);

    for (const target of ["standalone", "start9", "umbrel"]) {
        assert.match(anonymousReadbackScript, new RegExp(`"${target}"`));
    }
    assert.match(anonymousReadbackScript, /linux/);
    assert.match(anonymousReadbackScript, /amd64/);
    assert.match(anonymousReadbackScript, /arm64/);
});
