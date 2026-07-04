import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildStart9Package, listTarEntries, readTarEntry} from "../scripts/build-start9-package.mjs";

test("Start9 package builder creates SDK source artifact", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-start9-test-"));

    try {
        const result = await buildStart9Package({
            version: "0.0.0 test",
            outDir: tempDir,
            image: "ghcr.io/sandwichfarm/meshdrop:v0.0.0-start9"
        });
        const entries = await listTarEntries(result.artifactPath);
        const prefix = "meshdrop-start9-0.0.0-test";

        assert.equal(result.version, "0.0.0-test");
        for (const entry of [
            "Makefile",
            "package.json",
            "instructions.md",
            "README.md",
            "UAT-START9.md",
            "meshdrop-target.json",
            "assets/ABOUT.md",
            "startos/manifest/index.ts",
            "startos/main.ts",
            "startos/interfaces.ts"
        ]) {
            assert(entries.includes(`${prefix}/${entry}`), `${entry} missing from Start9 artifact`);
        }

        const packageJson = await readTarEntry(result.artifactPath, `${prefix}/package.json`);
        assert.match(packageJson, /"@start9labs\/start-sdk": "1\.5\.3"/);
        assert.match(packageJson, /"typescript": "5\.8\.3"/);

        const manifest = await readTarEntry(result.artifactPath, `${prefix}/startos/manifest/index.ts`);
        assert.match(manifest, /id: "meshdrop"/);
        assert.match(manifest, /dockerTag: "ghcr\.io\/sandwichfarm\/meshdrop:v0\.0\.0-start9"/);
        assert.match(manifest, /arch: \["x86_64", "aarch64"\]/);

        const main = await readTarEntry(result.artifactPath, `${prefix}/startos/main.ts`);
        assert.match(main, /MESHDROP_TARGET: "start9"/);
        assert.match(main, /MESHDROP_DISCOVERY_NPUBS: ""/);
        assert.match(main, /MESHDROP_ADMIN_NPUB: ""/);
        assert.match(main, /POLLEN_TRANSFER: "true"/);
        assert.doesNotMatch(main, /NOSTR_ROOM|FIPS_ROOM|POLLEN_ROOM/);

        const target = await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`);
        assert.match(target, /"target": "start9"/);
        assert.match(target, /"s9pkBuilt": false/);
        assert.match(target, /"staticRooms": false/);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
