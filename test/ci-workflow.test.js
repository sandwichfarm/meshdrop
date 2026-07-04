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

test("CI builds mobile native-source artifacts through package scripts", () => {
    assert.match(ciWorkflow, /mobile-native-source-artifacts:/);
    assert.match(ciWorkflow, /name: Mobile native source artifact smoke/);
    assert.match(ciWorkflow, /needs: unit/);
    assert.match(ciWorkflow, /npm run build:ios:native-source -- --version 0\.0\.0-ci --out-dir "\$\{out_dir\}"/);
    assert.match(ciWorkflow, /npm run build:android:native-source -- --version 0\.0\.0-ci --out-dir "\$\{out_dir\}"/);
    assert.match(ciWorkflow, /meshdrop-ios-native-source-0\.0\.0-ci\.tar\.gz/);
    assert.match(ciWorkflow, /MeshDropViewController\.swift/);
    assert.match(ciWorkflow, /Resources\/meshdrop\/index\.html/);
    assert.match(ciWorkflow, /meshdrop-android-native-source-0\.0\.0-ci\.tar\.gz/);
    assert.match(ciWorkflow, /AndroidManifest\.xml/);
    assert.match(ciWorkflow, /MainActivity\.java/);
    assert.match(ciWorkflow, /assets\/meshdrop\/index\.html/);
});
