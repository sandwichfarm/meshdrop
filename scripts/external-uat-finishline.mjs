import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const releaseTagPattern = /^v0\.\d+\.\d+$/;

export function parseExternalUatArgs(argv = [], env = process.env) {
    const tagArgs = [];
    const options = {
        statusOnly: false,
        json: false,
        reportPath: ""
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--status") {
            options.statusOnly = true;
            continue;
        }
        if (arg === "--json") {
            options.json = true;
            continue;
        }
        if (arg === "--report") {
            const reportPath = String(argv[index + 1] || "").trim();
            if (!reportPath) throw new Error("--report requires a file path");
            options.reportPath = reportPath;
            index += 1;
            continue;
        }
        tagArgs.push(arg);
    }

    return {
        ...options,
        tag: parseReleaseTag(tagArgs, env)
    };
}

export function parseReleaseTag(argv = [], env = process.env) {
    const tag = String(argv[0] || env.MESHDROP_RELEASE_TAG || "").trim();
    if (!tag) return "";
    if (!releaseTagPattern.test(tag)) {
        throw new Error(`Release tag must match v0.x.y, got ${tag}`);
    }
    return tag;
}

function missingEnv(env, keys) {
    return keys.filter((key) => !String(env[key] || "").trim());
}

function command(name, args) {
    return {name, args};
}

export function buildExternalUatPlan({argv = [], env = process.env, platform = process.platform} = {}) {
    const tag = parseReleaseTag(argv, env);
    const checks = [
        {
            id: "start9-deployed",
            label: "Start9 deployed-device UAT",
            requiredEnv: ["MESHDROP_START9_UAT_URL"],
            command: command("npm", ["run", "test:start9-deployed"]),
            blocker:
                "Set MESHDROP_START9_UAT_URL=<installed StartOS service URL> and run npm run test:start9-deployed."
        },
        {
            id: "umbrel-deployed",
            label: "Umbrel deployed-node UAT",
            requiredEnv: ["MESHDROP_UMBREL_UAT_URL"],
            command: command("npm", ["run", "test:umbrel-deployed"]),
            blocker:
                "Set MESHDROP_UMBREL_UAT_URL=<installed Umbrel service URL> and run npm run test:umbrel-deployed."
        },
        {
            id: "ios-signed-device",
            label: "iOS signed physical-device UAT",
            requiredEnv: ["MESHDROP_IOS_DEVELOPMENT_TEAM", "MESHDROP_IOS_DEVICE_UDID"],
            command: command("npm", ["run", "test:ios-signed-device"]),
            blocker:
                "Run on macOS with Xcode, a signed physical iOS device, MESHDROP_IOS_DEVELOPMENT_TEAM, and MESHDROP_IOS_DEVICE_UDID."
        },
        {
            id: "ghcr-anonymous",
            label: "anonymous GHCR release readback",
            requiredEnv: [],
            command: tag ? command("npm", ["run", "verify:ghcr-anonymous", "--", tag]) : null,
            blocker:
                "Pass a release tag with npm run test:external-uat -- v0.x.y or set MESHDROP_RELEASE_TAG=v0.x.y.",
            failureAction:
                "Make ghcr.io/sandwichfarm/meshdrop publicly readable or record an authenticated-only release policy, then rerun anonymous GHCR readback."
        }
    ];

    return {
        tag,
        checks: checks.map((check) => {
            const missing = missingEnv(env, check.requiredEnv);
            if (check.id === "ios-signed-device" && platform !== "darwin") {
                return {
                    ...check,
                    status: "blocked",
                    reason: "macOS with Xcode and a physical iOS device is required."
                };
            }
            if (missing.length > 0) {
                return {
                    ...check,
                    status: "blocked",
                    reason: `Missing ${missing.join(", ")}. ${check.blocker}`
                };
            }
            if (!check.command) {
                return {
                    ...check,
                    status: "blocked",
                    reason: check.blocker
                };
            }
            return {...check, status: "ready"};
        })
    };
}

function commandText(commandConfig) {
    if (!commandConfig) return "";
    return [commandConfig.name, ...commandConfig.args].join(" ");
}

function nextActionForCheck(check) {
    if (check.result === "passed") return "No action needed.";
    if (check.result === "failed" && check.failureAction) return `${check.failureAction} Last failure: ${check.reason}`;
    if (check.reason) return check.reason;
    if (check.command) return `Run ${commandText(check.command)}.`;
    return check.blocker;
}

export function buildExternalUatReport({
    tag = "",
    mode = "execute",
    checks = [],
    generatedAt = new Date().toISOString()
} = {}) {
    const normalizedChecks = checks.map((check) => {
        const status = check.result || check.status || "unknown";
        return {
            id: check.id,
            label: check.label,
            status,
            command: commandText(check.command),
            requiredEnv: check.requiredEnv || [],
            reason: check.reason || "",
            failureAction: check.failureAction || "",
            nextAction: nextActionForCheck(check)
        };
    });
    const counts = normalizedChecks.reduce((acc, check) => {
        acc[check.status] = (acc[check.status] || 0) + 1;
        return acc;
    }, {});
    const complete = normalizedChecks.length > 0 && normalizedChecks.every((check) => check.status === "passed");

    return {
        generatedAt,
        tag,
        mode,
        complete,
        counts,
        checks: normalizedChecks
    };
}

export function formatExternalUatReport(report) {
    const lines = [
        `External UAT finish-line status for ${report.tag || "(missing tag)"}`,
        `Mode: ${report.mode}`,
        `Complete: ${report.complete ? "yes" : "no"}`
    ];

    for (const check of report.checks) {
        lines.push(`- ${check.label}: ${check.status}`);
        if (check.reason) lines.push(`  Reason: ${check.reason}`);
        lines.push(`  Next: ${check.nextAction}`);
    }

    if (report.complete) {
        lines.push(`Proof external-uat-finishline: all external UAT checks passed for ${report.tag}`);
    }
    else {
        lines.push("Not proven: external UAT finish line has blockers.");
    }

    return `${lines.join("\n")}\n`;
}

async function writeReport(reportPath, report) {
    if (!reportPath) return;
    await fs.mkdir(path.dirname(path.resolve(reportPath)), {recursive: true});
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runCommand(name, args, {env = process.env} = {}) {
    return new Promise((resolve, reject) => {
        const child = execFile(name, args, {env: {...process.env, ...env}}, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
        child.stdout?.pipe(process.stdout);
        child.stderr?.pipe(process.stderr);
    });
}

export function buildExternalUatStatus({
    argv = process.argv.slice(2),
    env = process.env,
    platform = process.platform,
    generatedAt
} = {}) {
    const options = parseExternalUatArgs(argv, env);
    const plan = buildExternalUatPlan({
        argv: options.tag ? [options.tag] : [],
        env,
        platform
    });
    return buildExternalUatReport({
        tag: plan.tag,
        mode: "status",
        checks: plan.checks,
        generatedAt
    });
}

export async function runExternalUatFinishline({
    argv = process.argv.slice(2),
    env = process.env,
    platform = process.platform,
    runner = runCommand,
    generatedAt,
    reportWriter = writeReport
} = {}) {
    const options = parseExternalUatArgs(argv, env);
    const plan = buildExternalUatPlan({
        argv: options.tag ? [options.tag] : [],
        env,
        platform
    });
    if (options.statusOnly) {
        const report = buildExternalUatReport({
            tag: plan.tag,
            mode: "status",
            checks: plan.checks,
            generatedAt
        });
        await reportWriter(options.reportPath, report);
        return {plan, results: [], report};
    }

    const results = [];

    for (const check of plan.checks) {
        if (check.status !== "ready") {
            results.push({...check, result: "blocked"});
            continue;
        }

        try {
            await runner(check.command.name, check.command.args, {env});
            results.push({...check, result: "passed"});
        }
        catch (error) {
            results.push({...check, result: "failed", reason: error.message});
        }
    }

    const report = buildExternalUatReport({
        tag: plan.tag,
        mode: "execute",
        checks: results,
        generatedAt
    });
    await reportWriter(options.reportPath, report);

    const incomplete = results.filter((result) => result.result !== "passed");
    if (incomplete.length > 0) {
        console.error("Not proven: external UAT finish line has blockers.");
        for (const result of incomplete) {
            console.error(`- ${result.label}: ${result.reason}`);
        }
        throw new Error("external UAT finish line is not complete");
    }

    console.log(
        `Proof external-uat-finishline: Start9 deployed UAT, Umbrel deployed UAT, iOS signed-device UAT, and anonymous GHCR readback passed for ${plan.tag}`
    );
    return {plan, results, report};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const options = parseExternalUatArgs(process.argv.slice(2));
        const {report} = await runExternalUatFinishline();
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
        }
        else if (options.statusOnly) {
            console.log(formatExternalUatReport(report));
        }
        if (options.statusOnly && !report.complete) process.exitCode = 1;
    }
    catch (error) {
        if (!/external UAT finish line is not complete/.test(error.message)) {
            console.error(`Not proven: ${error.message}`);
        }
        process.exitCode = 1;
    }
}
