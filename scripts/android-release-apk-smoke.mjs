import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildAndroidReleaseApkPackage, listTarEntries, readTarEntry} from "./build-mobile-package.mjs";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-android-release-apk-smoke-"));

try {
    const result = await buildAndroidReleaseApkPackage({
        version: "0.0.0-smoke",
        outDir: tempDir,
        env: process.env
    });
    const prefix = "meshdrop-android-release-apk-0.0.0-smoke";
    const entries = await listTarEntries(result.artifactPath);

    assert.equal(result.androidReleaseApk, true);
    assert.equal(result.nativeSource, true);
    assert(entries.includes(`${prefix}/meshdrop-target.json`));
    assert(entries.includes(`${prefix}/apk/meshdrop-android-release.apk`));
    assert(entries.includes(`${prefix}/apk/build-proof.json`));
    assert(entries.includes(`${prefix}/apk/output-metadata.json`));
    assert(entries.includes(`${prefix}/native/android/app/src/main/java/farm/sandwich/meshdrop/MainActivity.java`));
    assert(entries.includes(`${prefix}/native/android/app/src/main/assets/meshdrop/index.html`));

    const manifest = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/meshdrop-target.json`));
    assert.equal(manifest.name, "meshdrop-android-release-apk");
    assert.equal(manifest.target, "android");
    assert.equal(manifest.nativeShellBuilt, true);
    assert.equal(manifest.nativeShellSourceBuilt, true);
    assert.equal(manifest.nativePackage.packageType, "release-apk");
    assert.equal(manifest.nativePackage.path, "apk/meshdrop-android-release.apk");
    assert.equal(manifest.nativePackage.signed, "uat-release");
    assert.equal(manifest.nativePackage.releaseSigned, true);
    assert.equal(manifest.nativePackage.productionSigning, false);
    assert.equal(manifest.transports.webrtc, true);
    assert.equal(manifest.transports.nostr, true);
    assert.equal(manifest.transports.bluetooth, false);
    assert(manifest.remainingProof.includes("physical Android device install UAT"));
    assert(!manifest.remainingProof.includes("Android native file picker UI UAT"));
    assert(manifest.remainingProof.includes("Bluetooth transport negotiation"));
    assert(!manifest.remainingProof.includes("signed Android release APK or AAB package"));
    assert(!manifest.remainingProof.includes("mobile file picker and share sheet"));
    assert(!manifest.remainingProof.includes("native Android WebRTC transfer UAT"));

    const proof = JSON.parse(await readTarEntry(result.artifactPath, `${prefix}/apk/build-proof.json`));
    assert.equal(proof.packageType, "release-apk");
    assert.equal(proof.gradleTask, "assembleRelease");
    assert.equal(proof.apk, "meshdrop-android-release.apk");
    assert.equal(proof.releaseSigned, true);
    assert.equal(proof.productionSigning, false);
    assert.match(proof.apkSha256, /^[0-9a-f]{64}$/);
    assert.equal(proof.signature.verified, true);
    assert.match(proof.signature.certificateSha256, /^[0-9A-F]{64}$/i);
    assert(proof.signature.outputLines.some(line => line.includes("certificate SHA-256 digest:")));
    assert(proof.notProven.includes("physical Android device install UAT"));
    assert(!proof.notProven.includes("Android native file picker UI UAT"));
    assert(proof.notProven.includes("Bluetooth transport negotiation"));
    assert(proof.notProven.includes("Play Store upload signing"));
    assert(proof.notProven.includes("Android App Bundle package"));

    const extractDir = path.join(tempDir, "extract");
    await fs.mkdir(extractDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", extractDir, `${prefix}/apk/meshdrop-android-release.apk`]);
    const apkPath = path.join(extractDir, prefix, "apk", "meshdrop-android-release.apk");
    const apk = await fs.readFile(apkPath);
    assert(apk.length > 1024, "release APK should not be empty");
    assert.equal(apk.subarray(0, 2).toString("utf8"), "PK");

    console.log(
        `Proof android-release-apk-build: built ${path.basename(result.artifactPath)} with ${apk.length} byte ` +
            "UAT-signed release APK verified by apksigner"
    );
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
