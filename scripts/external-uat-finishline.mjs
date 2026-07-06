import {execFile} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

const releaseTagPattern = /^v0\.\d+\.\d+$/;

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
                "Pass a release tag with npm run test:external-uat -- v0.x.y or set MESHDROP_RELEASE_TAG=v0.x.y."
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

export async function runExternalUatFinishline({
    argv = process.argv.slice(2),
    env = process.env,
    platform = process.platform,
    runner = runCommand
} = {}) {
    const plan = buildExternalUatPlan({argv, env, platform});
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
    return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        await runExternalUatFinishline();
    }
    catch (error) {
        if (!/external UAT finish line is not complete/.test(error.message)) {
            console.error(`Not proven: ${error.message}`);
        }
        process.exitCode = 1;
    }
}
