import test from "node:test";
import assert from "node:assert/strict";

import {
    buildExternalUatPlan,
    parseReleaseTag,
    runExternalUatFinishline
} from "../scripts/external-uat-finishline.mjs";

test("external UAT finish-line plan names every current external blocker", () => {
    const plan = buildExternalUatPlan({
        argv: ["v0.1.5"],
        env: {},
        platform: "linux"
    });

    assert.equal(plan.tag, "v0.1.5");
    assert.deepEqual(
        plan.checks.filter((check) => check.status === "blocked").map((check) => check.id),
        ["start9-deployed", "umbrel-deployed", "ios-signed-device"]
    );
    assert.match(
        plan.checks.find((check) => check.id === "ios-signed-device").reason,
        /macOS with Xcode and a physical iOS device/
    );
    assert.equal(plan.checks.find((check) => check.id === "ghcr-anonymous").status, "ready");
});

test("external UAT finish-line plan builds exact harness commands when all inputs exist", () => {
    const env = {
        MESHDROP_START9_UAT_URL: "https://meshdrop.startos.test",
        MESHDROP_UMBREL_UAT_URL: "https://meshdrop.umbrel.test",
        MESHDROP_IOS_DEVELOPMENT_TEAM: "ABCDE12345",
        MESHDROP_IOS_DEVICE_UDID: "00008110-001122334455801E"
    };

    const plan = buildExternalUatPlan({
        argv: ["v0.1.5"],
        env,
        platform: "darwin"
    });

    assert.deepEqual(
        plan.checks.map((check) => [check.id, check.status, check.command.name, check.command.args]),
        [
            ["start9-deployed", "ready", "npm", ["run", "test:start9-deployed"]],
            ["umbrel-deployed", "ready", "npm", ["run", "test:umbrel-deployed"]],
            ["ios-signed-device", "ready", "npm", ["run", "test:ios-signed-device"]],
            ["ghcr-anonymous", "ready", "npm", ["run", "verify:ghcr-anonymous", "--", "v0.1.5"]]
        ]
    );
});

test("external UAT finish-line runner executes ready checks before reporting blockers", async () => {
    const commands = [];

    await assert.rejects(
        runExternalUatFinishline({
            argv: ["v0.1.5"],
            env: {
                MESHDROP_START9_UAT_URL: "https://meshdrop.startos.test",
                MESHDROP_UMBREL_UAT_URL: "https://meshdrop.umbrel.test"
            },
            platform: "linux",
            runner: async (name, args) => {
                commands.push([name, args]);
            }
        }),
        /external UAT finish line is not complete/
    );

    assert.deepEqual(commands, [
        ["npm", ["run", "test:start9-deployed"]],
        ["npm", ["run", "test:umbrel-deployed"]],
        ["npm", ["run", "verify:ghcr-anonymous", "--", "v0.1.5"]]
    ]);
});

test("external UAT finish-line release tags fail closed", () => {
    assert.equal(parseReleaseTag([], {MESHDROP_RELEASE_TAG: "v0.1.5"}), "v0.1.5");
    assert.throws(() => parseReleaseTag(["1.2.3"], {}), /Release tag must match v0\.x\.y/);
});
