import test from "node:test";
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";

import {buildStart9Package, listTarEntries, readTarEntry} from "../scripts/build-start9-package.mjs";

const run = promisify(execFile);

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
            "s9pk.mk",
            "package.json",
            "icon.png",
            "LICENSE",
            "instructions.md",
            "README.md",
            "UAT-START9.md",
            "meshdrop-target.json",
            "assets/ABOUT.md",
            "startos/manifest/index.ts",
            "startos/versions/current.ts",
            "startos/versions/index.ts",
            "startos/main.ts",
            "startos/interfaces.ts"
        ]) {
            assert(entries.includes(`${prefix}/${entry}`), `${entry} missing from Start9 artifact`);
        }

        const packageJson = await readTarEntry(result.artifactPath, `${prefix}/package.json`);
        assert.match(packageJson, /"@start9labs\/start-sdk": "1\.5\.3"/);
        assert.match(packageJson, /"typescript": "5\.8\.3"/);

        const makefile = await readTarEntry(result.artifactPath, `${prefix}/Makefile`);
        assert.match(makefile, /include s9pk\.mk/);

        const s9pkMakefile = await readTarEntry(result.artifactPath, `${prefix}/s9pk.mk`);
        assert.match(s9pkMakefile, /\$\(BASE_NAME\)\.s9pk: javascript\/index\.js/);
        assert.match(s9pkMakefile, /\$\(BASE_NAME\)_%\.s9pk: javascript\/index\.js/);

        const tsconfig = await readTarEntry(result.artifactPath, `${prefix}/tsconfig.json`);
        assert.match(tsconfig, /"outDir": "javascript"/);

        const manifest = await readTarEntry(result.artifactPath, `${prefix}/startos/manifest/index.ts`);
        assert.match(manifest, /id: "meshdrop"/);
        assert.match(manifest, /license: "GPL-3\.0"/);
        assert.match(manifest, /buildManifest\(versionGraph, staticManifest\)/);
        assert.match(manifest, /dockerTag: "ghcr\.io\/sandwichfarm\/meshdrop:v0\.0\.0-start9"/);
        assert.match(manifest, /arch: \["x86_64", "aarch64"\]/);

        const version = await readTarEntry(result.artifactPath, `${prefix}/startos/versions/current.ts`);
        assert.match(version, /version: "0\.0\.0-test:0"/);
        assert.match(version, /down: IMPOSSIBLE/);

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

test("Start9 generated package source typechecks against declared SDK dependency", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-start9-typecheck-"));

    try {
        const result = await buildStart9Package({
            version: "0.0.0 typecheck",
            outDir: tempDir,
            image: "ghcr.io/sandwichfarm/meshdrop:v0.0.0-start9"
        });
        const prefix = "meshdrop-start9-0.0.0-typecheck";
        const packageDir = path.join(tempDir, prefix);

        await run("tar", ["-xzf", result.artifactPath, "-C", tempDir]);
        await run("npm", ["install", "--ignore-scripts", "--no-audit", "--fund=false"], {cwd: packageDir});
        await run("npm", ["run", "check"], {cwd: packageDir});
        await run("npm", ["run", "build"], {cwd: packageDir});
        await fs.access(path.join(packageDir, "javascript", "index.js"));
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
