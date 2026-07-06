import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
    iosDeviceAppPath,
    prepareIosNativeSource,
    run
} from "./ios-xcode-smoke-helpers.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const defaultBundleId = "farm.sandwich.meshdrop";
const appGroupId = "group.farm.sandwich.meshdrop";

export function parseIosSignedDeviceEnv(env = process.env, platform = process.platform) {
    if (platform !== "darwin") {
        throw new Error("signed iOS device UAT requires macOS with Xcode.");
    }

    const developmentTeam = requireEnv(env, "MESHDROP_IOS_DEVELOPMENT_TEAM");
    const deviceId = requireEnv(env, "MESHDROP_IOS_DEVICE_UDID");
    const signingIdentity = (env.MESHDROP_IOS_SIGNING_IDENTITY || "").trim();
    const provisioningProfile = (env.MESHDROP_IOS_PROVISIONING_PROFILE || "").trim();
    const version = (env.MESHDROP_IOS_SIGNED_UAT_VERSION || packageJson.version).trim();

    return {
        developmentTeam,
        deviceId,
        signingIdentity,
        provisioningProfile,
        version,
        allowProvisioningUpdates: env.MESHDROP_IOS_ALLOW_PROVISIONING_UPDATES === "1",
        bundleId: defaultBundleId
    };
}

export function signedIosBuildArgs({projectPath, derivedDataPath, config}) {
    const args = [
        "-project", projectPath,
        "-scheme", "MeshDrop",
        "-configuration", "Release",
        "-sdk", "iphoneos",
        "-destination", `id=${config.deviceId}`,
        "-derivedDataPath", derivedDataPath
    ];

    if (config.allowProvisioningUpdates) {
        args.push("-allowProvisioningUpdates", "-allowProvisioningDeviceRegistration");
    }

    args.push(
        `DEVELOPMENT_TEAM=${config.developmentTeam}`,
        "CODE_SIGN_STYLE=Automatic",
        "CODE_SIGNING_ALLOWED=YES",
        "CODE_SIGNING_REQUIRED=YES"
    );

    if (config.signingIdentity) {
        args.push(`CODE_SIGN_IDENTITY=${config.signingIdentity}`);
    }
    if (config.provisioningProfile) {
        args.push(`PROVISIONING_PROFILE_SPECIFIER=${config.provisioningProfile}`);
    }

    args.push("build");
    return args;
}

export async function runIosSignedDeviceUat(env = process.env, platform = process.platform) {
    const config = parseIosSignedDeviceEnv(env, platform);
    await assertToolchain(config);

    const prepared = await prepareIosNativeSource({
        version: config.version,
        smokeName: "ios-signed-device-uat",
        buildId: "ios-signed-device-uat",
        env
    });

    try {
        const derivedDataPath = path.join(prepared.workDir, "DerivedData");
        await run("xcodebuild", signedIosBuildArgs({
            projectPath: prepared.projectPath,
            derivedDataPath,
            config
        }), {env});

        const appPath = iosDeviceAppPath(derivedDataPath);
        const shareExtensionPath = path.join(appPath, "PlugIns", "MeshDropShareExtension.appex");
        await fs.access(path.join(appPath, "Info.plist"));
        await fs.access(path.join(shareExtensionPath, "Info.plist"));
        await assertSignedEntitlements(appPath);
        await assertSignedEntitlements(shareExtensionPath);
        await run("xcrun", ["devicectl", "device", "install", "app", "--device", config.deviceId, appPath], {env});

        console.log(
            `Proof ios-signed-device-install: signed ${config.bundleId} ${config.version} ` +
            `for ${config.deviceId}; App Group entitlements inspected; installed through devicectl`
        );
    }
    finally {
        await prepared.cleanup();
    }
}

function requireEnv(env, key) {
    const value = (env[key] || "").trim();
    if (!value) {
        throw new Error(`Set ${key} before claiming signed iOS device UAT.`);
    }
    return value;
}

async function assertToolchain(config) {
    await run("xcodebuild", ["-version"]);
    await run("xcrun", ["--find", "devicectl"]);
    await run("codesign", ["--version"]);
    if (config.signingIdentity) {
        const {stdout} = await run("security", ["find-identity", "-v", "-p", "codesigning"]);
        assert.match(stdout, new RegExp(escapeRegExp(config.signingIdentity)), "signing identity should be installed in keychain");
    }
}

async function assertSignedEntitlements(bundlePath) {
    const {stdout} = await run("codesign", ["-d", "--entitlements", ":-", bundlePath]);
    assert.match(stdout, /com\.apple\.security\.application-groups/, `${bundlePath} must carry App Group entitlement`);
    assert.match(stdout, new RegExp(escapeRegExp(appGroupId)), `${bundlePath} must carry MeshDrop App Group`);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        await runIosSignedDeviceUat();
    }
    catch (error) {
        console.error(`Not proven: ${error.message}`);
        process.exitCode = 1;
    }
}
