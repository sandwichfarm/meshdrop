import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    buildIosDeviceArchivePackage,
    parseIosDeviceArchiveArgs
} from "../scripts/build-ios-device-archive-package.mjs";
import {listTarEntries, readTarEntry} from "../scripts/build-mobile-package.mjs";

test("iOS device archive package builder creates unsigned iphoneos archive", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ios-device-archive-test-"));
    const fakeBin = path.join(tempDir, "bin");

    try {
        await fs.mkdir(fakeBin);
        await fs.writeFile(path.join(fakeBin, "xcodebuild"), `#!/bin/sh
set -eu
archive=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-archivePath" ]; then
    shift
    archive="$1"
  fi
  shift || true
done
if [ -z "$archive" ]; then
  archive="$TMPDIR/MeshDrop.xcarchive"
fi
app="$archive/Products/Applications/MeshDrop.app"
mkdir -p "$app"
printf '<plist><dict></dict></plist>\\n' > "$archive/Info.plist"
printf '<plist><dict></dict></plist>\\n' > "$app/Info.plist"
printf 'fake xcodebuild archive\\n'
`, {mode: 0o755});

        const result = await buildIosDeviceArchivePackage({
            version: "0.0.0 test",
            outDir: tempDir,
            env: {
                ...process.env,
                PATH: `${fakeBin}:${process.env.PATH || ""}`,
                MESH_DROP_BUILD_ID: "unit-ios-device-archive"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const proof = JSON.parse(await readTarEntry(result.artifactPath, `${result.prefix}/build-proof.json`));

        assert.equal(result.version, "0.0.0-test");
        assert.equal(result.packageType, "unsigned-device-archive");
        assert(entries.includes(`${result.prefix}/MeshDrop.xcarchive/Info.plist`));
        assert(entries.includes(`${result.prefix}/MeshDrop.xcarchive/Products/Applications/MeshDrop.app/Info.plist`));
        assert(entries.includes(`${result.prefix}/build-proof.json`));
        assert.equal(proof.target, "ios");
        assert.equal(proof.sdk, "iphoneos");
        assert.equal(proof.codeSigningAllowed, false);
        assert.equal(proof.deviceInstallable, false);
        assert.deepEqual(proof.remainingProof, [
            "signed/device-installable iOS package",
            "App Group entitlement provisioning",
            "iOS device file-picker UAT",
            "iOS share-sheet device UAT",
            "native iOS WebRTC transfer UAT"
        ]);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});

test("iOS device archive package args parse version and output directory", () => {
    assert.deepEqual(parseIosDeviceArchiveArgs(["--version", "1.2.3 test", "--out-dir", "/tmp/meshdrop-ios"]), {
        version: "1.2.3 test",
        outDir: "/tmp/meshdrop-ios"
    });
    assert.throws(() => parseIosDeviceArchiveArgs(["--target", "ios"]), /Unknown argument/);
});
