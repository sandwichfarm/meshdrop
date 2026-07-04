import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildDesktopPackage, listTarEntries, readTarEntry} from "../scripts/build-desktop-package.mjs";

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
