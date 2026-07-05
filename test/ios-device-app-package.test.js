import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    buildIosDeviceAppPackage,
    parseIosDeviceAppArgs
} from "../scripts/build-ios-device-app-package.mjs";
import {listTarEntries, readTarEntry} from "../scripts/build-mobile-package.mjs";

test("iOS device app package builder creates unsigned iphoneos app product", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ios-device-app-test-"));
    const fakeBin = path.join(tempDir, "bin");

    try {
        await fs.mkdir(fakeBin);
        await fs.writeFile(path.join(fakeBin, "xcodebuild"), `#!/bin/sh
set -eu
derived_data=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-derivedDataPath" ]; then
    shift
    derived_data="$1"
  fi
  shift || true
done
if [ -z "$derived_data" ]; then
  derived_data="$TMPDIR/DerivedData"
fi
app="$derived_data/Build/Products/Release-iphoneos/MeshDrop.app"
mkdir -p "$app"
printf '<plist><dict></dict></plist>\\n' > "$app/Info.plist"
printf 'fake xcodebuild device build\\n'
`, {mode: 0o755});

        const result = await buildIosDeviceAppPackage({
            version: "0.0.0 test",
            outDir: tempDir,
            env: {
                ...process.env,
                PATH: `${fakeBin}:${process.env.PATH || ""}`,
                MESH_DROP_BUILD_ID: "unit-ios-device-app"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const proof = JSON.parse(await readTarEntry(result.artifactPath, `${result.prefix}/build-proof.json`));

        assert.equal(result.version, "0.0.0-test");
        assert.equal(result.packageType, "unsigned-device-app");
        assert(entries.includes(`${result.prefix}/MeshDrop.app/Info.plist`));
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

test("iOS device app package args parse version and output directory", () => {
    assert.deepEqual(parseIosDeviceAppArgs(["--version", "1.2.3 test", "--out-dir", "/tmp/meshdrop-ios"]), {
        version: "1.2.3 test",
        outDir: "/tmp/meshdrop-ios"
    });
    assert.throws(() => parseIosDeviceAppArgs(["--target", "ios"]), /Unknown argument/);
});
