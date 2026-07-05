import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {
    findAndroidSdk,
    run,
    stripCarriageReturns
} from "./android-apk-runtime-utils.mjs";

const requiredScripts = [
    "test:android-apk-install",
    "test:android-webview-capabilities",
    "test:android-webview-transfer",
    "test:android-share-file",
    "test:android-picker-ui"
];

export function parseAdbDevices(stdout) {
    return stripCarriageReturns(stdout)
        .split("\n")
        .slice(1)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const [serial, state, ...details] = line.split(/\s+/);
            return {
                serial,
                state,
                details: details.join(" ")
            };
        });
}

export function selectPhysicalDevice(devices, requestedSerial = "") {
    const attached = devices.filter(device => device.state === "device");
    if (requestedSerial) {
        const match = attached.find(device => device.serial === requestedSerial);
        if (!match) {
            throw new Error(`Requested Android device ${requestedSerial} is not attached and ready.`);
        }
        if (match.isEmulator) {
            throw new Error(`Requested Android device ${requestedSerial} is an emulator; physical-device UAT requires hardware.`);
        }
        return match;
    }

    const physical = attached.filter(device => !device.isEmulator);
    if (physical.length === 0) {
        throw new Error("No physical Android device attached. Attach hardware or set MESHDROP_ANDROID_SERIAL to a physical device serial.");
    }
    if (physical.length > 1) {
        throw new Error(
            "Multiple physical Android devices are attached. Set MESHDROP_ANDROID_SERIAL to the intended device serial: " +
            physical.map(device => device.serial).join(", ")
        );
    }
    return physical[0];
}

export async function discoverPhysicalAndroidDevice(env = process.env) {
    const sdkRoot = findAndroidSdk(env);
    const adb = env.MESHDROP_ADB || path.join(sdkRoot, "platform-tools", "adb");
    await run(adb, ["start-server"]);
    const {stdout} = await run(adb, ["devices", "-l"]);
    const devices = parseAdbDevices(stdout);
    const annotated = [];
    for (const device of devices) {
        annotated.push({
            ...device,
            isEmulator: await isEmulatorDevice(adb, device)
        });
    }
    const selected = selectPhysicalDevice(annotated, env.MESHDROP_ANDROID_SERIAL || "");
    const info = await getPhysicalDeviceInfo(adb, selected.serial);
    return {
        adb,
        sdkRoot,
        serial: selected.serial,
        info
    };
}

export async function runPhysicalDeviceUat(env = process.env) {
    const device = await discoverPhysicalAndroidDevice(env);
    const childEnv = {
        ...env,
        ANDROID_HOME: device.sdkRoot,
        ANDROID_SDK_ROOT: device.sdkRoot,
        MESHDROP_ANDROID_SERIAL: device.serial
    };
    delete childEnv.MESHDROP_ANDROID_AVD;
    delete childEnv.MESHDROP_ANDROID_EMULATOR;

    for (const script of requiredScripts) {
        await runNpmScript(script, childEnv);
    }

    console.log(
        `Proof android-physical-device-uat: ${device.info.manufacturer} ${device.info.model} ` +
        `Android ${device.info.release} API ${device.info.sdk} (${device.info.abi}) on ${device.serial}; ` +
        `passed ${requiredScripts.join(", ")}`
    );
}

async function isEmulatorDevice(adb, device) {
    if (device.state !== "device") return true;
    if (device.serial.startsWith("emulator-")) return true;
    const qemu = await getprop(adb, device.serial, "ro.kernel.qemu");
    return qemu === "1";
}

async function getPhysicalDeviceInfo(adb, serial) {
    const [manufacturer, model, release, sdk, abi] = await Promise.all([
        getprop(adb, serial, "ro.product.manufacturer"),
        getprop(adb, serial, "ro.product.model"),
        getprop(adb, serial, "ro.build.version.release"),
        getprop(adb, serial, "ro.build.version.sdk"),
        getprop(adb, serial, "ro.product.cpu.abi")
    ]);
    assert(manufacturer, "physical Android device manufacturer should be readable");
    assert(model, "physical Android device model should be readable");
    assert(release, "physical Android version should be readable");
    assert(sdk, "physical Android API level should be readable");
    return {manufacturer, model, release, sdk, abi};
}

async function getprop(adb, serial, key) {
    const {stdout} = await run(adb, ["-s", serial, "shell", "getprop", key]);
    return stripCarriageReturns(stdout).trim();
}

function runNpmScript(script, env) {
    return new Promise((resolve, reject) => {
        execFile("npm", ["run", script], {
            env,
            timeout: 20 * 60_000,
            maxBuffer: 1024 * 1024 * 32
        }, (error, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (error) {
                error.message = `Android physical-device step failed: npm run ${script}\n${error.message}`;
                reject(error);
                return;
            }
            resolve();
        });
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        await runPhysicalDeviceUat();
    }
    catch (error) {
        console.error(`Not proven: ${error.message}`);
        process.exitCode = 1;
    }
}
