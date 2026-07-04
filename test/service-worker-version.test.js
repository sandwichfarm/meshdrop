import test from "node:test";
import assert from "node:assert/strict";

import {
    cacheVersionFromEnv,
    sanitizeVersion,
    updateServiceWorkerVersion
} from "../scripts/set-service-worker-version.mjs";

test("service worker cache version includes package version, commit, and build id", () => {
    assert.equal(
        cacheVersionFromEnv({
            MESH_DROP_COMMIT: "abc123",
            MESH_DROP_BUILD_ID: "2026-07-03T19:00:00.000Z"
        }, "1.11.2"),
        "v1.11.2-abc123-2026-07-03T19-00-00.000Z"
    );
});

test("service worker cache version can be overridden explicitly", () => {
    assert.equal(
        cacheVersionFromEnv({MESH_DROP_CACHE_VERSION: "custom build/version"}, "1.11.2"),
        "custom-build-version"
    );
});

test("service worker cache version replacement updates only the declaration", () => {
    const source = "const cacheVersion = 'old';\nconst cacheTitle = `meshdrop-cache-${cacheVersion}`;\n";

    assert.equal(
        updateServiceWorkerVersion(source, sanitizeVersion("v1.11.2-abc-123")),
        "const cacheVersion = 'v1.11.2-abc-123';\nconst cacheTitle = `meshdrop-cache-${cacheVersion}`;\n"
    );
});
