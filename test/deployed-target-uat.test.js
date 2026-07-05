import assert from "node:assert/strict";
import test from "node:test";

import {
    envKeyForTarget,
    normalizeBaseUrl,
    parseTarget
} from "../scripts/deployed-target-uat.mjs";

test("parseTarget accepts deployed Start9 and Umbrel targets", () => {
    assert.equal(parseTarget(["node", "script", "start9"]), "start9");
    assert.equal(parseTarget(["node", "script", "umbrel"]), "umbrel");
});

test("parseTarget rejects unsupported deployed targets", () => {
    assert.throws(
        () => parseTarget(["node", "script", "docker"]),
        /Usage: node scripts\/deployed-target-uat\.mjs <start9\|umbrel>/
    );
});

test("envKeyForTarget maps deployed target URL variables", () => {
    assert.equal(envKeyForTarget("start9"), "MESHDROP_START9_UAT_URL");
    assert.equal(envKeyForTarget("umbrel"), "MESHDROP_UMBREL_UAT_URL");
});

test("normalizeBaseUrl trims trailing slashes", () => {
    assert.equal(normalizeBaseUrl(" https://meshdrop.local/app/// "), "https://meshdrop.local/app");
});

test("normalizeBaseUrl rejects non-http URLs", () => {
    assert.throws(
        () => normalizeBaseUrl("file:///tmp/meshdrop"),
        /Unsupported deployed target URL protocol file:/
    );
});
