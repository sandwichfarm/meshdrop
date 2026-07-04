import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    buildMobileNativeSourcePackage,
    buildMobilePackage,
    listTarEntries,
    parseArgs,
    readTarEntry
} from "../scripts/build-mobile-package.mjs";

const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
const expectedRemainingProof = [
    "native mobile shell source artifact",
    "native mobile app package build",
    "native mobile WebRTC transfer UAT",
    "mobile file picker and share sheet",
    "Bluetooth transport negotiation"
];
const expectedNativeSourceRemainingProof = [
    "native mobile app package build",
    "native mobile WebRTC transfer UAT",
    "mobile file picker and share sheet",
    "Bluetooth transport negotiation"
];

for (const target of ["ios", "android"]) {
    test(`${target} package builder creates source artifact with target metadata`, async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `meshdrop-${target}-test-`));

        try {
            const result = await buildMobilePackage({
                target,
                version: "0.0.0 test",
                outDir: tempDir,
                env: {
                    MESH_DROP_BUILD_ID: "unit"
                }
            });
            const entries = await listTarEntries(result.artifactPath);
            const prefix = `meshdrop-${target}-0.0.0-test`;

            assert.equal(result.version, "0.0.0-test");
            assert.equal(result.target, target);
            assert(entries.includes(`${prefix}/app/index.html`));
            assert(entries.includes(`${prefix}/app/scripts/runtime-capabilities.js`));
            assert(entries.includes(`${prefix}/app/service-worker.js`));
            assert(entries.includes(`${prefix}/meshdrop-target.json`));
            assert(entries.includes(`${prefix}/README-${target.toUpperCase()}.md`));
            assert(entries.includes(`${prefix}/UAT-MOBILE.md`));
            assert(!entries.some(entry => entry.includes("/server/")));
            assert(!entries.some(entry => entry.includes("/node_modules/")));

            const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
            assert.equal(manifest.target, target);
            assert.equal(manifest.nativeShellBuilt, false);
            assert.equal(manifest.nativeShellSourceBuilt, false);
            assert.equal(manifest.runtime.platform, "mobile");
            assert.equal(manifest.runtime.hasBackend, false);
            assert.equal(manifest.runtime.sharedInstance, false);
            assert.equal(manifest.transports.webrtc, true);
            assert.equal(manifest.transports.nostr, true);
            assert.equal(manifest.transports.blossom, true);
            assert.equal(manifest.transports.hashtree, true);
            assert.equal(manifest.transports.localDiscovery, false);
            assert.equal(manifest.transports.pollen, false);
            assert.equal(manifest.transports.fips, false);
            assert.equal(manifest.transports.bluetooth, false);
            assert.deepEqual(manifest.remainingProof, expectedRemainingProof);

            const readme = await readTarEntry(result.artifactPath, `${prefix}/README-${target.toUpperCase()}.md`);
            assert.match(readme, /not a signed mobile app/i);
        }
        finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    });

    test(`${target} native source builder creates platform wrapper source artifact`, async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `meshdrop-${target}-native-source-test-`));

        try {
            const result = await buildMobileNativeSourcePackage({
                target,
                version: "0.0.0 test",
                outDir: tempDir,
                env: {
                    MESH_DROP_BUILD_ID: "unit-native-source"
                }
            });
            const entries = await listTarEntries(result.artifactPath);
            const prefix = `meshdrop-${target}-native-source-0.0.0-test`;
            const nativeRoot = `${prefix}/native/${target}`;

            assert.equal(result.version, "0.0.0-test");
            assert.equal(result.target, target);
            assert.equal(result.nativeSource, true);
            assert(entries.includes(`${prefix}/app/index.html`));
            assert(entries.includes(`${prefix}/meshdrop-target.json`));
            assert(entries.includes(`${prefix}/README-${target.toUpperCase()}.md`));
            assert(entries.includes(`${prefix}/UAT-MOBILE.md`));
            assert(entries.includes(`${nativeRoot}/README.md`));

            if (target === "ios") {
                assert(entries.includes(`${nativeRoot}/MeshDrop/MeshDropApp.swift`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/MeshDropViewController.swift`));
                assert(entries.includes(`${nativeRoot}/MeshDrop/Resources/meshdrop/index.html`));
            }
            else {
                assert(entries.includes(`${nativeRoot}/settings.gradle`));
                assert(entries.includes(`${nativeRoot}/app/build.gradle`));
                assert(entries.includes(`${nativeRoot}/app/src/main/AndroidManifest.xml`));
                assert(entries.includes(`${nativeRoot}/app/src/main/assets/meshdrop/index.html`));
                assert(entries.includes(`${nativeRoot}/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`));
            }

            const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
            assert.equal(manifest.name, `meshdrop-${target}-native-source`);
            assert.equal(manifest.target, target);
            assert.equal(manifest.nativeShellBuilt, false);
            assert.equal(manifest.nativeShellSourceBuilt, true);
            assert.equal(manifest.runtime.platform, "mobile");
            assert.equal(manifest.runtime.hasBackend, false);
            assert.equal(manifest.runtime.sharedInstance, false);
            assert.equal(manifest.transports.webrtc, false);
            assert.equal(manifest.transports.nostr, false);
            assert.equal(manifest.transports.localDiscovery, false);
            assert.equal(manifest.transports.pollen, false);
            assert.equal(manifest.transports.fips, false);
            assert.equal(manifest.transports.bluetooth, false);
            assert.equal(manifest.nativeSource.sourceRoot, `native/${target}`);
            assert.deepEqual(manifest.remainingProof, expectedNativeSourceRemainingProof);

            const wrapperSource = await readTarEntry(
                result.artifactPath,
                target === "ios"
                    ? `${nativeRoot}/MeshDrop/MeshDropViewController.swift`
                    : `${nativeRoot}/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`
            );
            assert.match(wrapperSource, /__meshdropTargetManifest/);

            const readme = await readTarEntry(result.artifactPath, `${prefix}/README-${target.toUpperCase()}.md`);
            assert.match(readme, /not a signed app/i);
        }
        finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    });
}

test("mobile package builder requires an explicit supported target", () => {
    assert.deepEqual(parseArgs(["--target", "ios"]), {
        version: packageJson.version,
        outDir: path.resolve(new URL("..", import.meta.url).pathname, "dist"),
        target: "ios",
        nativeSource: false
    });
    assert.deepEqual(parseArgs(["--target", "android", "--native-source"]), {
        version: packageJson.version,
        outDir: path.resolve(new URL("..", import.meta.url).pathname, "dist"),
        target: "android",
        nativeSource: true
    });
    assert.rejects(() => buildMobilePackage({target: "desktop"}), /ios or android/);
});
