import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildUmbrelPackage, listTarEntries, readTarEntry} from "../scripts/build-umbrel-package.mjs";

test("Umbrel package builder creates app manifest and compose artifact", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-umbrel-test-"));

    try {
        const result = await buildUmbrelPackage({
            version: "0.0.0 test",
            outDir: tempDir,
            image: "ghcr.io/sandwichfarm/meshdrop:v0.0.0-umbrel"
        });
        const entries = await listTarEntries(result.artifactPath);
        const prefix = "meshdrop-umbrel-0.0.0-test";

        assert.equal(result.version, "0.0.0-test");
        assert(entries.includes(`${prefix}/umbrel-app.yml`));
        assert(entries.includes(`${prefix}/docker-compose.yml`));
        assert(entries.includes(`${prefix}/meshdrop-target.json`));
        assert(entries.includes(`${prefix}/UAT-UMBREL.md`));

        const appManifest = await readTarEntry(result.artifactPath, `${prefix}/umbrel-app.yml`);
        assert.match(appManifest, /manifestVersion: 1/);
        assert.match(appManifest, /id: meshdrop/);
        assert.match(appManifest, /version: "0.0.0-test"/);
        assert.match(appManifest, /port: 3000/);

        const compose = await readTarEntry(result.artifactPath, `${prefix}/docker-compose.yml`);
        assert.match(compose, /APP_HOST: meshdrop_server_1/);
        assert.match(compose, /image: ghcr\.io\/sandwichfarm\/meshdrop:v0\.0\.0-umbrel/);
        assert.match(compose, /MESHDROP_TARGET=umbrel/);
        assert.match(compose, /MESHDROP_DISCOVERY_NPUBS=/);
        assert.match(compose, /MESHDROP_ADMIN_NPUB=/);
        assert.match(compose, /POLLEN_TRANSFER=true/);
        assert.doesNotMatch(compose, /NOSTR_ROOM|FIPS_ROOM|POLLEN_ROOM/);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
