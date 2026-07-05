import test from "node:test";
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";

import {
    buildDesktopChromiumPackage,
    buildDesktopNativePackage,
    buildDesktopPackage,
    listTarEntries,
    readTarEntry
} from "../scripts/build-desktop-package.mjs";

const execFileAsync = promisify(execFile);

test("Desktop package builder creates source artifact with target metadata", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-test-"));

    try {
        const result = await buildDesktopPackage({
            version: "0.0.0 test",
            outDir: tempDir,
            env: {
                MESH_DROP_BUILD_ID: "unit"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const prefix = "meshdrop-desktop-0.0.0-test";

        assert.equal(result.version, "0.0.0-test");
        assert(entries.includes(`${prefix}/app/index.html`));
        assert(entries.includes(`${prefix}/app/scripts/runtime-capabilities.js`));
        assert(entries.includes(`${prefix}/app/service-worker.js`));
        assert(entries.includes(`${prefix}/meshdrop-target.json`));
        assert(entries.includes(`${prefix}/README-DESKTOP.md`));
        assert(entries.includes(`${prefix}/UAT-DESKTOP.md`));
        assert(!entries.some(entry => entry.includes("/server/")));
        assert(!entries.some(entry => entry.includes("/node_modules/")));

        const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
        assert.equal(manifest.target, "desktop");
        assert.equal(manifest.nativeShellBuilt, false);
        assert.equal(manifest.runtime.platform, "desktop");
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
        assert.deepEqual(manifest.remainingProof, [
            "native shell build",
            "native desktop WebRTC transfer UAT",
            "desktop installer or signed binary"
        ]);

        const readme = await readTarEntry(result.artifactPath, `${prefix}/README-DESKTOP.md`);
        assert.match(readme, /not a native installer or executable/i);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});

test("Desktop Chromium shell package creates WebRTC-capable desktop shell artifact", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-chromium-test-"));

    try {
        const result = await buildDesktopChromiumPackage({
            version: "0.0.0 chromium",
            outDir: tempDir,
            env: {
                MESH_DROP_BUILD_ID: "unit-chromium"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const prefix = "meshdrop-desktop-chromium-0.0.0-chromium";
        const extractDir = path.join(tempDir, "extract");

        assert.equal(result.version, "0.0.0-chromium");
        assert.equal(result.mode, "chromium");
        assert.equal(result.nativeShellBuilt, true);
        assert(entries.includes(`${prefix}/app/index.html`));
        assert(entries.includes(`${prefix}/bin/meshdrop-desktop-chromium.mjs`));
        assert(entries.includes(`${prefix}/src/meshdrop-desktop-chromium.mjs`));
        assert(entries.includes(`${prefix}/meshdrop-target.json`));
        assert(entries.includes(`${prefix}/README-DESKTOP.md`));
        assert(entries.includes(`${prefix}/UAT-DESKTOP.md`));

        const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
        assert.equal(manifest.name, "meshdrop-desktop-chromium");
        assert.equal(manifest.target, "desktop");
        assert.equal(manifest.nativeShellBuilt, true);
        assert.equal(manifest.chromiumShellBuilt, true);
        assert.equal(manifest.runtime.platform, "desktop");
        assert.equal(manifest.runtime.hasBackend, false);
        assert.equal(manifest.nativeShell.executable, "bin/meshdrop-desktop-chromium.mjs");
        assert.equal(manifest.nativeShell.toolkit, "chromium");
        assert.equal(manifest.transports.webrtc, true);
        assert.equal(manifest.transports.nostr, true);
        assert.deepEqual(manifest.remainingProof, [
            "bundled Chromium engine or installer",
            "desktop installer or signed binary"
        ]);

        await fs.mkdir(extractDir);
        await execFileAsync("tar", ["-xzf", result.artifactPath, "-C", extractDir]);
        const launcher = path.join(extractDir, prefix, "bin", "meshdrop-desktop-chromium.mjs");
        const appDir = path.join(extractDir, prefix, "app");
        const {stdout} = await execFileAsync(process.execPath, [
            launcher,
            "--meshdrop-print-config",
            "--app-dir",
            appDir
        ]);
        const smoke = JSON.parse(stdout);

        assert.equal(smoke.target, "desktop");
        assert.equal(smoke.shell, "chromium");
        assert.equal(smoke.appIndexExists, true);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});

test("Desktop Chromium shell can bundle a Chromium engine", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-chromium-bundle-test-"));

    try {
        const fakeEngineDir = path.join(tempDir, "fake-chromium");
        const fakeEngine = path.join(fakeEngineDir, "chrome");
        await fs.mkdir(fakeEngineDir, {recursive: true});
        await fs.writeFile(fakeEngine, "#!/bin/sh\nexit 0\n");
        await fs.chmod(fakeEngine, 0o755);

        const result = await buildDesktopChromiumPackage({
            version: "0.0.0 bundled",
            outDir: tempDir,
            chromiumBundlePath: fakeEngine,
            env: {
                MESH_DROP_BUILD_ID: "unit-chromium-bundled"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const prefix = "meshdrop-desktop-chromium-bundled-0.0.0-bundled";
        const extractDir = path.join(tempDir, "extract");

        assert.equal(result.chromiumEngineBundled, true);
        assert(entries.includes(`${prefix}/bin/chromium/chrome`));

        const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
        assert.equal(manifest.name, "meshdrop-desktop-chromium-bundled");
        assert.equal(manifest.chromiumEngineBundled, true);
        assert.equal(manifest.nativeShell.chromiumExecutable, "bin/chromium/chrome");
        assert.deepEqual(manifest.remainingProof, [
            "desktop installer or signed binary"
        ]);

        await fs.mkdir(extractDir);
        await execFileAsync("tar", ["-xzf", result.artifactPath, "-C", extractDir]);
        const launcher = path.join(extractDir, prefix, "bin", "meshdrop-desktop-chromium.mjs");
        const appDir = path.join(extractDir, prefix, "app");
        const {stdout} = await execFileAsync(process.execPath, [
            launcher,
            "--meshdrop-print-config",
            "--app-dir",
            appDir
        ]);
        const smoke = JSON.parse(stdout);

        assert.equal(smoke.chromium, path.join(extractDir, prefix, "bin", "chromium", "chrome"));
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});

test("Desktop native package builder compiles a Linux shell artifact", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-native-test-"));

    try {
        const result = await buildDesktopNativePackage({
            version: "0.0.0 native",
            outDir: tempDir,
            env: {
                MESH_DROP_BUILD_ID: "unit"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const prefix = "meshdrop-desktop-linux-0.0.0-native";
        const extractDir = path.join(tempDir, "extract");

        assert.equal(result.version, "0.0.0-native");
        assert.equal(result.nativeShellBuilt, true);
        assert(entries.includes(`${prefix}/app/index.html`));
        assert(entries.includes(`${prefix}/bin/meshdrop-desktop`));
        assert(entries.includes(`${prefix}/src/meshdrop-desktop.c`));
        assert(entries.includes(`${prefix}/meshdrop-target.json`));
        assert(entries.includes(`${prefix}/README-DESKTOP.md`));
        assert(entries.includes(`${prefix}/UAT-DESKTOP.md`));

        const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
        assert.equal(manifest.target, "desktop");
        assert.equal(manifest.nativeShellBuilt, true);
        assert.equal(manifest.runtime.platform, "desktop");
        assert.equal(manifest.runtime.hasBackend, false);
        assert.equal(manifest.nativeShell.executable, "bin/meshdrop-desktop");
        assert.equal(manifest.nativeShell.toolkit, "gtk4-webkitgtk");
        assert.equal(manifest.transports.webrtc, false);
        assert.equal(manifest.transports.nostr, false);
        assert.deepEqual(manifest.remainingProof, [
            "native engine with RTCPeerConnection support",
            "native desktop WebRTC transfer UAT",
            "desktop installer or signed binary"
        ]);

        await fs.mkdir(extractDir);
        await execFileAsync("tar", ["-xzf", result.artifactPath, "-C", extractDir]);
        const binary = path.join(extractDir, prefix, "bin", "meshdrop-desktop");
        const appDir = path.join(extractDir, prefix, "app");
        const {stdout} = await execFileAsync(binary, ["--meshdrop-print-config", "--app-dir", appDir]);
        const smoke = JSON.parse(stdout);

        assert.equal(smoke.target, "desktop");
        assert.equal(smoke.nativeShellBuilt, true);
        assert.equal(smoke.appIndexExists, true);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
