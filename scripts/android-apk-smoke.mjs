import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildAndroidApkPackage, listTarEntries, readTarEntry} from "./build-mobile-package.mjs";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-apk-smoke-"));

try {
    const result = await buildAndroidApkPackage({
        version: "0.0.0-smoke",
        outDir: tempDir,
        env: process.env
    });
    const prefix = "meshdrop-android-apk-0.0.0-smoke";
    const entries = await listTarEntries(result.artifactPath);

    assert.equal(result.androidApk, true);
    assert.equal(result.nativeSource, true);
    assert(entries.includes(`${prefix}/meshdrop-target.json`));
    assert(entries.includes(`${prefix}/apk/meshdrop-android-debug.apk`));
    assert(entries.includes(`${prefix}/apk/build-proof.json`));
    assert(entries.includes(`${prefix}/apk/output-metadata.json`));
    assert(entries.includes(`${prefix}/native/android/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`));
    assert(entries.includes(`${prefix}/native/android/app/src/main/assets/meshdrop/index.html`));

    const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
    assert.equal(manifest.name, "meshdrop-android-apk");
    assert.equal(manifest.target, "android");
    assert.equal(manifest.nativeShellBuilt, true);
    assert.equal(manifest.nativeShellSourceBuilt, true);
    assert.equal(manifest.nativePackage.packageType, "debug-apk");
    assert.equal(manifest.nativePackage.path, "apk/meshdrop-android-debug.apk");
    assert.equal(manifest.nativePackage.releaseSigned, false);
    assert.equal(manifest.transports.webrtc, false);
    assert.equal(manifest.transports.nostr, false);
    assert.equal(manifest.transports.bluetooth, false);
    assert(manifest.remainingProof.includes("native Android WebRTC transfer UAT"));

    const proof = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/apk/build-proof.json`));
    assert.equal(proof.gradleTask, "assembleDebug");
    assert.equal(proof.apk, "meshdrop-android-debug.apk");
    assert.equal(proof.releaseSigned, false);

    const extractDir = path.join(tempDir, "extract");
    await fs.mkdir(extractDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", extractDir, `${prefix}/apk/meshdrop-android-debug.apk`]);
    const apkPath = path.join(extractDir, prefix, "apk", "meshdrop-android-debug.apk");
    const apk = await fs.readFile(apkPath);
    assert(apk.length > 1024, "debug APK should not be empty");
    assert.equal(apk.subarray(0, 2).toString("utf8"), "PK");

    console.log(`Proof android-apk-build: built ${path.basename(result.artifactPath)} with ${apk.length} byte debug APK`);
}
finally {
    await fs.rm(tempDir, {recursive: true, force: true});
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}\n${stderr}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}
