import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildSpaArtifact, listTarEntries, sanitizeArtifactPart} from "../scripts/build-spa-artifact.mjs";

test("SPA artifact builder packages public assets with target metadata", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-spa-test-"));

    try {
        const result = await buildSpaArtifact({
            version: "0.0.0 test",
            outDir: tempDir,
            env: {
                MESH_DROP_BUILD_ID: "unit"
            }
        });
        const entries = await listTarEntries(result.artifactPath);

        assert.equal(result.version, "0.0.0-test");
        assert(entries.includes("meshdrop-spa-0.0.0-test/index.html"));
        assert(entries.includes("meshdrop-spa-0.0.0-test/scripts/runtime-capabilities.js"));
        assert(entries.includes("meshdrop-spa-0.0.0-test/service-worker.js"));
        assert(entries.includes("meshdrop-spa-0.0.0-test/meshdrop-target.json"));
        assert(entries.includes("meshdrop-spa-0.0.0-test/UAT-SPA.md"));
        assert(!entries.includes("meshdrop-spa-0.0.0-test/scripts/libs/heic2any.min.js"));
        assert(!entries.some(entry => entry.includes("/server/")));
        assert(!entries.some(entry => entry.includes("/node_modules/")));
        assert(!entries.some(entry => entry.endsWith("/package.json")));
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});

test("SPA artifact smoke proves backend-free Nostr WebRTC transfer", async () => {
    const smoke = await fs.readFile(new URL("../scripts/spa-artifact-smoke.mjs", import.meta.url), "utf8");
    const ciWorkflow = await fs.readFile(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");

    assert.match(smoke, /PLAYWRIGHT_BROWSER/);
    assert.match(smoke, /browserTypeName/);
    assert.match(smoke, /\[\"chromium\", "firefox", "webkit"\]/);
    assert.match(smoke, /newContext\(\{serviceWorkers: "block"\}\)/);
    assert.match(smoke, /backend-free-spa-nostr-webrtc/);
    assert.match(smoke, /startFakeRelay/);
    assert.match(smoke, /meshdropNostrMesh\.connect/);
    assert.match(smoke, /meshdrop-spa-proof\.txt/);
    assert.match(smoke, /safeDebugPageState/);
    assert.match(smoke, /undefined, \{timeout: spaHydrationTimeoutMs\}/);

    assert.match(ciWorkflow, /spa-browser-matrix:/);
    assert.match(ciWorkflow, /browser: \[chromium, firefox, webkit\]/);
    assert.match(ciWorkflow, /npx playwright install --with-deps \$\{\{ matrix\.browser \}\}/);
    assert.match(ciWorkflow, /PLAYWRIGHT_BROWSER: \$\{\{ matrix\.browser \}\}/);
    assert.match(ciWorkflow, /npm run test:spa-artifact/);
});

test("SPA artifact version sanitizer rejects empty versions", () => {
    assert.equal(sanitizeArtifactPart("v0.1.0+build 1"), "v0.1.0-build-1");
    assert.throws(() => sanitizeArtifactPart("///"), /empty/);
});
