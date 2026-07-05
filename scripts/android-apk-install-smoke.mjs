import assert from "node:assert/strict";
import {execFile, spawn} from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildAndroidApkPackage} from "./build-mobile-package.mjs";

const packageName = "farm.sandwich.meshdrop";
const mainActivity = `${packageName}/.MainActivity`;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-apk-install-smoke-"));
let emulatorProcess = null;
let serial = process.env.MESHDROP_ANDROID_SERIAL || "";

try {
    const sdkRoot = findAndroidSdk(process.env);
    const adb = process.env.MESHDROP_ADB || path.join(sdkRoot, "platform-tools", "adb");
    const emulator = process.env.MESHDROP_ANDROID_EMULATOR || path.join(sdkRoot, "emulator", "emulator");

    await run(adb, ["start-server"]);
    if (!serial) {
        serial = await findAttachedDevice(adb);
    }
    if (!serial) {
        const avd = process.env.MESHDROP_ANDROID_AVD;
        if (!avd) {
            throw new Error(
                "No Android device/emulator attached. Set MESHDROP_ANDROID_AVD to launch a local AVD, " +
                "or MESHDROP_ANDROID_SERIAL to use an attached device."
            );
        }
        serial = `emulator-${process.env.MESHDROP_ANDROID_EMULATOR_PORT || "5580"}`;
        emulatorProcess = launchEmulator(emulator, avd, process.env.MESHDROP_ANDROID_EMULATOR_PORT || "5580");
    }

    await waitForBoot(adb, serial);

    const result = await buildAndroidApkPackage({
        version: "0.0.0-install-smoke",
        outDir: tempDir,
        env: {
            ...process.env,
            ANDROID_HOME: sdkRoot,
            ANDROID_SDK_ROOT: sdkRoot
        }
    });
    const prefix = "meshdrop-android-apk-0.0.0-install-smoke";
    const extractDir = path.join(tempDir, "extract");
    await fs.mkdir(extractDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", extractDir, `${prefix}/apk/meshdrop-android-debug.apk`]);

    const apkPath = path.join(extractDir, prefix, "apk", "meshdrop-android-debug.apk");
    const apk = await fs.readFile(apkPath);
    assert(apk.length > 1024, "debug APK should not be empty");
    assert.equal(apk.subarray(0, 2).toString("utf8"), "PK");

    await run(adb, ["-s", serial, "install", "-r", apkPath], {timeoutMs: 120_000});
    const packagePath = await run(adb, ["-s", serial, "shell", "pm", "path", packageName]);
    assert.match(packagePath.stdout, new RegExp(`package:.+/${packageName}-.+/base\\.apk`));

    const resolvedActivity = await run(adb, ["-s", serial, "shell", "cmd", "package", "resolve-activity", "--brief", packageName]);
    assert.match(stripCarriageReturns(resolvedActivity.stdout), new RegExp(`${packageName}/\\.MainActivity`));

    await run(adb, ["-s", serial, "shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"]);
    await sleep(3000);
    const topActivity = await run(adb, ["-s", serial, "shell", "dumpsys", "activity", "top"]);
    assert.match(stripCarriageReturns(topActivity.stdout), new RegExp(`ACTIVITY ${packageName}/\\.MainActivity`));

    const release = await run(adb, ["-s", serial, "shell", "getprop", "ro.build.version.release"]);
    const abiResult = await run(adb, ["-s", serial, "shell", "getprop", "ro.product.cpu.abi"]);
    const androidRelease = stripCarriageReturns(release.stdout).trim();
    const abi = stripCarriageReturns(abiResult.stdout).trim();
    console.log(
        `Proof android-apk-emulator-install: installed ${path.basename(result.artifactPath)} on ${serial} ` +
        `(Android ${androidRelease}, ${abi}) and launched ${mainActivity}`
    );
}
finally {
    if (emulatorProcess) {
        await shutdownEmulator();
    }
    await fs.rm(tempDir, {recursive: true, force: true});
}

function findAndroidSdk(env) {
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
        stdio: ["ignore", "ignore", "ignore"]
    });

    return child;
}

async function waitForBoot(adb, deviceSerial) {
    await run(adb, ["-s", deviceSerial, "wait-for-device"], {timeoutMs: 120_000});
    for (let i = 0; i < 120; i += 1) {
        const {stdout} = await run(adb, ["-s", deviceSerial, "shell", "getprop", "sys.boot_completed"]);
        if (stripCarriageReturns(stdout).trim() === "1") {
            return;
        }
        await sleep(1000);
    }
    throw new Error(`Timed out waiting for ${deviceSerial} to boot`);
}

async function shutdownEmulator() {
    const adb = process.env.MESHDROP_ADB || path.join(findAndroidSdk(process.env), "platform-tools", "adb");
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

function run(command, args, options = {}) {
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

function stripCarriageReturns(value) {
    return value.replace(/\r/g, "");
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
