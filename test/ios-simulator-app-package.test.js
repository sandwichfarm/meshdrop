import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    buildIosSimulatorAppPackage,
    parseIosSimulatorAppArgs
} from "../scripts/build-ios-simulator-app-package.mjs";
import {listTarEntries, readTarEntry} from "../scripts/build-mobile-package.mjs";

test("iOS simulator app package builder creates unsigned app archive", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ios-simulator-app-test-"));
    const fakeBin = path.join(tempDir, "bin");

    try {
        await fs.mkdir(fakeBin);
        await fs.writeFile(path.join(fakeBin, "xcodebuild"), `#!/bin/sh
set -eu
derived=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-derivedDataPath" ]; then
    shift
    derived="$1"
  fi
  shift || true
done
if [ -z "$derived" ]; then
  derived="$TMPDIR/meshdrop-fake-derived-data"
fi
app="$derived/Build/Products/Debug-iphonesimulator/MeshDrop.app"
mkdir -p "$app/Resources/meshdrop"
printf '<plist><dict></dict></plist>\\n' > "$app/Info.plist"
printf '<!doctype html>\\n' > "$app/Resources/meshdrop/index.html"
printf 'fake xcodebuild\\n'
`, {mode: 0o755});

        const result = await buildIosSimulatorAppPackage({
            version: "0.0.0 test",
            outDir: tempDir,
            env: {
                ...process.env,
                PATH: `${fakeBin}:${process.env.PATH || ""}`,
                MESH_DROP_BUILD_ID: "unit-ios-simulator-app"
            }
        });
        const entries = await listTarEntries(result.artifactPath);
        const proof = JSON.parse(await readTarEntry(result.artifactPath, `${result.prefix}/build-proof.json`));

        assert.equal(result.version, "0.0.0-test");
        assert.equal(result.packageType, "unsigned-simulator-app");
        assert(entries.includes(`${result.prefix}/MeshDrop.app/Info.plist`));
        assert(entries.includes(`${result.prefix}/MeshDrop.app/Resources/meshdrop/index.html`));
        assert(entries.includes(`${result.prefix}/build-proof.json`));
        assert.equal(proof.target, "ios");
        assert.equal(proof.sdk, "iphonesimulator");
        assert.equal(proof.codeSigningAllowed, false);
        assert.deepEqual(proof.remainingProof, [
            "signed/device-installable iOS package",
            "App Group entitlement provisioning",
            "iOS device file-picker UAT",
            "iOS share-sheet device UAT",
            "native iOS WebRTC transfer UAT",
            "Bluetooth transport negotiation"
        ]);
    }
    finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});

test("iOS simulator app package args parse version and output directory", () => {
    assert.deepEqual(parseIosSimulatorAppArgs(["--version", "1.2.3 test", "--out-dir", "/tmp/meshdrop-ios"]), {
        version: "1.2.3 test",
        outDir: "/tmp/meshdrop-ios"
    });
    assert.throws(() => parseIosSimulatorAppArgs(["--target", "ios"]), /Unknown argument/);
});
