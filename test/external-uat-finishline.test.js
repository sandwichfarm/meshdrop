import test from "node:test";
import assert from "node:assert/strict";

import {
    buildExternalUatReport,
    buildExternalUatStatus,
    buildExternalUatPlan,
    formatExternalUatReport,
    parseExternalUatArgs,
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
    const reports = [];

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
            },
            generatedAt: "2026-07-07T11:05:00.000Z",
            reportWriter: async (reportPath, report) => {
                reports.push([reportPath, report]);
            }
        }),
        /external UAT finish line is not complete/
    );

    assert.deepEqual(commands, [
        ["npm", ["run", "test:start9-deployed"]],
        ["npm", ["run", "test:umbrel-deployed"]],
        ["npm", ["run", "verify:ghcr-anonymous", "--", "v0.1.5"]]
    ]);
    assert.equal(reports.length, 1);
    assert.equal(reports[0][0], "");
    assert.equal(reports[0][1].mode, "execute");
    assert.equal(reports[0][1].complete, false);
    assert.deepEqual(reports[0][1].counts, {passed: 3, blocked: 1});
});

test("external UAT finish-line release tags fail closed", () => {
    assert.equal(parseReleaseTag([], {MESHDROP_RELEASE_TAG: "v0.1.5"}), "v0.1.5");
    assert.throws(() => parseReleaseTag(["1.2.3"], {}), /Release tag must match v0\.x\.y/);
});

test("external UAT finish-line args parse status, json, report, and tag", () => {
    assert.deepEqual(parseExternalUatArgs([
        "--status",
        "--json",
        "--report",
        "tmp/external-uat.json",
        "v0.1.5"
    ]), {
        statusOnly: true,
        json: true,
        reportPath: "tmp/external-uat.json",
        tag: "v0.1.5"
    });
    assert.throws(() => parseExternalUatArgs(["--report", ""]), /--report requires a file path/);
});

test("external UAT status report is durable and does not execute UAT commands", async () => {
    const writes = [];
    const {report, results} = await runExternalUatFinishline({
        argv: ["--status", "--report", "tmp/external-uat.json", "v0.1.5"],
        env: {},
        platform: "linux",
        generatedAt: "2026-07-07T11:05:00.000Z",
        runner: async () => {
            throw new Error("status mode must not execute commands");
        },
        reportWriter: async (reportPath, reportPayload) => {
            writes.push([reportPath, reportPayload]);
        }
    });

    assert.deepEqual(results, []);
    assert.equal(report.mode, "status");
    assert.equal(report.complete, false);
    assert.deepEqual(report.counts, {blocked: 3, ready: 1});
    assert.equal(writes[0][0], "tmp/external-uat.json");
    assert.equal(writes[0][1].checks.find((check) => check.id === "ghcr-anonymous").nextAction, "Run npm run verify:ghcr-anonymous -- v0.1.5.");
});

test("external UAT report maps GHCR failures to package visibility action", async () => {
    let report;
    await assert.rejects(
        runExternalUatFinishline({
            argv: ["v0.1.5"],
            env: {
                MESHDROP_START9_UAT_URL: "https://meshdrop.startos.test",
                MESHDROP_UMBREL_UAT_URL: "https://meshdrop.umbrel.test",
                MESHDROP_IOS_DEVELOPMENT_TEAM: "ABCDE12345",
                MESHDROP_IOS_DEVICE_UDID: "00008110-001122334455801E"
            },
            platform: "darwin",
            runner: async (name, args) => {
                if (args.includes("verify:ghcr-anonymous")) {
                    throw new Error("GHCR unauthorized");
                }
            },
            reportWriter: async (reportPath, reportPayload) => {
                report = reportPayload;
            }
        }),
        /external UAT finish line is not complete/
    );

    const ghcr = report.checks.find((check) => check.id === "ghcr-anonymous");
    assert.equal(ghcr.status, "failed");
    assert.match(ghcr.nextAction, /Make ghcr\.io\/sandwichfarm\/meshdrop publicly readable/);
    assert.match(ghcr.nextAction, /GHCR unauthorized/);
});

test("external UAT report formatting names blockers and next actions", () => {
    const report = buildExternalUatStatus({
        argv: ["v0.1.5"],
        env: {},
        platform: "linux",
        generatedAt: "2026-07-07T11:05:00.000Z"
    });
    const text = formatExternalUatReport(report);

    assert.match(text, /External UAT finish-line status for v0\.1\.5/);
    assert.match(text, /Start9 deployed-device UAT: blocked/);
    assert.match(text, /anonymous GHCR release readback: ready/);
    assert.match(text, /Not proven: external UAT finish line has blockers/);
});

test("external UAT complete report records proof state", () => {
    const report = buildExternalUatReport({
        tag: "v0.1.5",
        generatedAt: "2026-07-07T11:05:00.000Z",
        checks: [
            {id: "start9-deployed", label: "Start9", result: "passed", command: {name: "npm", args: ["run", "test:start9-deployed"]}}
        ]
    });

    assert.equal(report.complete, true);
    assert.equal(report.checks[0].nextAction, "No action needed.");
    assert.match(formatExternalUatReport(report), /Proof external-uat-finishline/);
});
