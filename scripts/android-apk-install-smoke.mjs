import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    androidMainActivity,
    buildAndExtractDebugApk,
    getAndroidDeviceInfo,
    installAndLaunchDebugApk,
    prepareAndroidDevice
} from "./android-apk-runtime-utils.mjs";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-apk-install-smoke-"));
let device = null;

try {
    device = await prepareAndroidDevice(process.env);
    const {artifactPath, apkPath} = await buildAndExtractDebugApk({
        version: "0.0.0-install-smoke",
        outDir: tempDir,
        sdkRoot: device.sdkRoot
    });
    await installAndLaunchDebugApk(device.adb, device.serial, apkPath);

    const info = await getAndroidDeviceInfo(device.adb, device.serial);
    console.log(
        `Proof android-apk-emulator-install: installed ${path.basename(artifactPath)} on ${device.serial} ` +
        `(Android ${info.release}, ${info.abi}) and launched ${androidMainActivity}`
    );
}
finally {
    if (device) {
        await device.shutdown();
    }
    await fs.rm(tempDir, {recursive: true, force: true});
}
