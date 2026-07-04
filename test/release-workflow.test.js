import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const releaseWorkflow = fs.readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const dockerfile = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

test("release workflow publishes GHCR images for alpha target packages", () => {
    assert.match(releaseWorkflow, /permissions:\n  contents: write\n  packages: write/);
    assert.match(releaseWorkflow, /container-images:/);
    assert.match(releaseWorkflow, /needs: release/);
    assert.match(releaseWorkflow, /target: \[standalone, start9, umbrel\]/);
    assert.match(releaseWorkflow, /docker login ghcr\.io/);
    assert.match(releaseWorkflow, /ghcr\.io\/\$\{GITHUB_REPOSITORY,,\}/);
    assert.match(releaseWorkflow, /--build-arg MESHDROP_TARGET="\$\{target\}"/);
    assert.match(releaseWorkflow, /docker push "\$\{image\}:\$\{tag\}-\$\{target\}"/);
    assert.match(releaseWorkflow, /docker push "\$\{image\}:\$\{version\}-\$\{target\}"/);
});

test("Dockerfile records the image target inside released containers", () => {
    assert.match(dockerfile, /ARG MESHDROP_TARGET=standalone/);
    assert.match(dockerfile, /ENV MESHDROP_TARGET="\$\{MESHDROP_TARGET\}"/);
    assert.match(dockerfile, /farm\.sandwich\.meshdrop\.target="\$\{MESHDROP_TARGET\}"/);
});
