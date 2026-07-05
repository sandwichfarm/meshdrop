import assert from "node:assert/strict";
import {execFile, spawn} from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildAndroidApkPackage} from "./build-mobile-package.mjs";

export const androidPackageName = "farm.sandwich.meshdrop";
export const androidMainActivity = `${androidPackageName}/.MainActivity`;

export async function prepareAndroidDevice(env = process.env) {
    const sdkRoot = findAndroidSdk(env);
    const adb = env.MESHDROP_ADB || path.join(sdkRoot, "platform-tools", "adb");
    const emulator = env.MESHDROP_ANDROID_EMULATOR || path.join(sdkRoot, "emulator", "emulator");
    const port = env.MESHDROP_ANDROID_EMULATOR_PORT || "5580";
    let emulatorProcess = null;
    let serial = env.MESHDROP_ANDROID_SERIAL || "";

    await run(adb, ["start-server"]);
    if (!serial) {
        serial = await findAttachedDevice(adb);
    }
    if (!serial) {
        const avd = env.MESHDROP_ANDROID_AVD;
        if (!avd) {
            throw new Error(
                "No Android device/emulator attached. Set MESHDROP_ANDROID_AVD to launch a local AVD, " +
                "or MESHDROP_ANDROID_SERIAL to use an attached device."
            );
        }
        serial = `emulator-${port}`;
        emulatorProcess = launchEmulator(emulator, avd, port);
    }

    await waitForBoot(adb, serial, Number(env.MESHDROP_ANDROID_BOOT_TIMEOUT_MS || 120_000), emulatorProcess);

    return {
        adb,
        sdkRoot,
        serial,
        async shutdown() {
            if (emulatorProcess) {
                await shutdownEmulator(adb, serial, emulatorProcess);
            }
        }
    };
}

export async function buildAndExtractDebugApk({version, outDir, sdkRoot, env = process.env}) {
    const result = await buildAndroidApkPackage({
        version,
        outDir,
        env: {
            ...env,
            ANDROID_HOME: sdkRoot,
            ANDROID_SDK_ROOT: sdkRoot
        }
    });
    const extractDir = path.join(outDir, "extract");
    const apkEntry = `${result.prefix}/apk/meshdrop-android-debug.apk`;
    await fs.mkdir(extractDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", extractDir, apkEntry]);

    const apkPath = path.join(extractDir, result.prefix, "apk", "meshdrop-android-debug.apk");
    const apk = await fs.readFile(apkPath);
    assert(apk.length > 1024, "debug APK should not be empty");
    assert.equal(apk.subarray(0, 2).toString("utf8"), "PK");

    return {artifactPath: result.artifactPath, apkPath};
}

export async function installAndLaunchDebugApk(adb, serial, apkPath) {
    await run(adb, ["-s", serial, "install", "-r", apkPath], {timeoutMs: 120_000});
    const packagePath = await run(adb, ["-s", serial, "shell", "pm", "path", androidPackageName]);
    assert.match(packagePath.stdout, new RegExp(`package:.+/${androidPackageName}-.+/base\\.apk`));

    const resolvedActivity = await run(adb, ["-s", serial, "shell", "cmd", "package", "resolve-activity", "--brief", androidPackageName]);
    assert.match(stripCarriageReturns(resolvedActivity.stdout), new RegExp(`${androidPackageName}/\\.MainActivity`));

    await run(adb, ["-s", serial, "shell", "am", "start", "-W", "-n", androidMainActivity]);
    await sleep(3000);
    const activities = await run(adb, ["-s", serial, "shell", "dumpsys", "activity", "activities"]);
    assert.match(stripCarriageReturns(activities.stdout), new RegExp(`ResumedActivity: ActivityRecord.* ${androidPackageName}/\\.MainActivity`));
}

export async function getAndroidDeviceInfo(adb, serial) {
    const release = await run(adb, ["-s", serial, "shell", "getprop", "ro.build.version.release"]);
    const abi = await run(adb, ["-s", serial, "shell", "getprop", "ro.product.cpu.abi"]);
    return {
        release: stripCarriageReturns(release.stdout).trim(),
        abi: stripCarriageReturns(abi.stdout).trim()
    };
}

export function findAndroidSdk(env) {
    const candidates = [
        env.ANDROID_HOME,
        env.ANDROID_SDK_ROOT,
        path.join(os.homedir(), "Android", "Sdk"),
        "/opt/android-sdk",
        "/usr/lib/android-sdk"
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fsSync.existsSync(path.join(candidate, "platform-tools", "adb"))) {
            return candidate;
        }
    }
    throw new Error("Android SDK with platform-tools/adb not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.");
}

export function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            cwd: options.cwd,
            env: options.env,
            timeout: options.timeoutMs || 60_000,
            maxBuffer: 1024 * 1024 * 8
        }, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}\n${stderr}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}

export function stripCarriageReturns(value) {
    return value.replace(/\r/g, "");
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findAttachedDevice(adb) {
    const {stdout} = await run(adb, ["devices"]);
    const line = stdout.split("\n").find(row => row.endsWith("\tdevice"));
    return line ? line.split(/\s+/)[0] : "";
}

function launchEmulator(emulator, avd, port) {
    const child = spawn(emulator, [
        "-avd", avd,
        "-read-only",
        "-no-window",
        "-no-audio",
        "-no-boot-anim",
        "-no-snapshot-save",
        "-no-snapshot-load",
        "-gpu", "swiftshader_indirect",
        "-port", port
    ], {
        stdio: ["ignore", "pipe", "pipe"]
    });
    child.output = "";
    child.stdout.on("data", chunk => {
        child.output = `${child.output}${chunk.toString()}`.slice(-4000);
    });
    child.stderr.on("data", chunk => {
        child.output = `${child.output}${chunk.toString()}`.slice(-4000);
    });
    return child;
}

async function waitForBoot(adb, deviceSerial, timeoutMs, emulatorProcess = null) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const {stdout} = await run(adb, ["devices"]);
        if (stdout.split("\n").some(row => row.trim() === `${deviceSerial}\tdevice`)) break;
        if (emulatorProcess && emulatorProcess.exitCode !== null) {
            throw new Error(`Android emulator exited before ADB saw ${deviceSerial}.\n${emulatorProcess.output}`);
        }
        await sleep(1000);
    }
    const {stdout} = await run(adb, ["devices"]);
    if (!stdout.split("\n").some(row => row.trim() === `${deviceSerial}\tdevice`)) {
        throw new Error(`Timed out waiting for ${deviceSerial} to appear in ADB.\n${emulatorProcess?.output || stdout}`);
    }
    while (Date.now() < deadline) {
        if (emulatorProcess && emulatorProcess.exitCode !== null) {
            throw new Error(`Android emulator exited before ${deviceSerial} booted.\n${emulatorProcess.output}`);
        }
        const {stdout} = await run(adb, ["-s", deviceSerial, "shell", "getprop", "sys.boot_completed"]);
        if (stripCarriageReturns(stdout).trim() === "1") {
            return;
        }
        await sleep(1000);
    }
    throw new Error(`Timed out waiting for ${deviceSerial} to boot`);
}

async function shutdownEmulator(adb, serial, emulatorProcess) {
    try {
        await run(adb, ["-s", serial, "emu", "kill"], {timeoutMs: 10_000});
    }
    catch {
        emulatorProcess.kill("SIGTERM");
    }
    await new Promise(resolve => {
        const timeout = setTimeout(resolve, 15_000);
        emulatorProcess.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}
