import assert from "node:assert/strict";
import test from "node:test";

import {
    devicectlInstallArgs,
    devicectlLaunchArgs,
    parseIosSignedDeviceEnv,
    signedIosBuildArgs
} from "../scripts/ios-signed-device-uat.mjs";

test("signed iOS device UAT rejects non-macOS runs", () => {
    assert.throws(
        () => parseIosSignedDeviceEnv({}, "linux"),
        /signed iOS device UAT requires macOS with Xcode/
    );
});

test("signed iOS device UAT requires real signing and device inputs", () => {
    assert.throws(
        () => parseIosSignedDeviceEnv({}, "darwin"),
        /Set MESHDROP_IOS_DEVELOPMENT_TEAM/
    );
    assert.throws(
        () => parseIosSignedDeviceEnv({MESHDROP_IOS_DEVELOPMENT_TEAM: "ABCDE12345"}, "darwin"),
        /Set MESHDROP_IOS_DEVICE_UDID/
    );
});

test("signed iOS device UAT builds for a specific device with signing enabled", () => {
    const config = parseIosSignedDeviceEnv({
        MESHDROP_IOS_DEVELOPMENT_TEAM: "ABCDE12345",
        MESHDROP_IOS_DEVICE_UDID: "00008110-001C11112222801E",
        MESHDROP_IOS_SIGNING_IDENTITY: "Apple Development: Mesh Drop",
        MESHDROP_IOS_PROVISIONING_PROFILE: "MeshDrop UAT",
        MESHDROP_IOS_SIGNED_UAT_VERSION: "0.1.5-uat",
        MESHDROP_IOS_ALLOW_PROVISIONING_UPDATES: "1"
    }, "darwin");

    assert.equal(config.developmentTeam, "ABCDE12345");
    assert.equal(config.deviceId, "00008110-001C11112222801E");
    assert.equal(config.version, "0.1.5-uat");
    assert.equal(config.allowProvisioningUpdates, true);

    const args = signedIosBuildArgs({
        projectPath: "/tmp/MeshDrop.xcodeproj",
        derivedDataPath: "/tmp/DerivedData",
        config
    });

    assert.deepEqual(args.slice(0, 12), [
        "-project", "/tmp/MeshDrop.xcodeproj",
        "-scheme", "MeshDrop",
        "-configuration", "Release",
        "-sdk", "iphoneos",
        "-destination", "id=00008110-001C11112222801E",
        "-derivedDataPath", "/tmp/DerivedData"
    ]);
    assert(args.includes("-allowProvisioningUpdates"));
    assert(args.includes("-allowProvisioningDeviceRegistration"));
    assert(args.includes("DEVELOPMENT_TEAM=ABCDE12345"));
    assert(args.includes("CODE_SIGN_STYLE=Automatic"));
    assert(args.includes("CODE_SIGNING_ALLOWED=YES"));
    assert(args.includes("CODE_SIGNING_REQUIRED=YES"));
    assert(args.includes("CODE_SIGN_IDENTITY=Apple Development: Mesh Drop"));
    assert(args.includes("PROVISIONING_PROFILE_SPECIFIER=MeshDrop UAT"));
    assert.equal(args.at(-1), "build");
});

test("signed iOS device UAT installs and launches the signed app", () => {
    const config = parseIosSignedDeviceEnv({
        MESHDROP_IOS_DEVELOPMENT_TEAM: "ABCDE12345",
        MESHDROP_IOS_DEVICE_UDID: "00008110-001C11112222801E"
    }, "darwin");

    assert.deepEqual(devicectlInstallArgs(config, "/tmp/MeshDrop.app"), [
        "devicectl",
        "device",
        "install",
        "app",
        "--device",
        "00008110-001C11112222801E",
        "/tmp/MeshDrop.app"
    ]);
    assert.deepEqual(devicectlLaunchArgs(config), [
        "devicectl",
        "device",
        "process",
        "launch",
        "--device",
        "00008110-001C11112222801E",
        "farm.sandwich.meshdrop"
    ]);
});
