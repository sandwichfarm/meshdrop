import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildIosDeviceArchivePackage} from "./build-ios-device-archive-package.mjs";
import {listTarEntries, readTarEntry} from "./build-mobile-package.mjs";

async function main() {
    const version = process.env.MESHDROP_IOS_DEVICE_ARCHIVE_SMOKE_VERSION || "0.0.0-ios-device-archive-smoke";
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ios-device-archive-smoke-"));

    try {
        const result = await buildIosDeviceArchivePackage({version, outDir});
        const entries = await listTarEntries(result.artifactPath);
        const proof = JSON.parse(await readTarEntry(result.artifactPath, `${result.prefix}/build-proof.json`));

        assert(entries.includes(`${result.prefix}/MeshDrop.xcarchive/Info.plist`));
        assert(entries.includes(`${result.prefix}/MeshDrop.xcarchive/Products/Applications/MeshDrop.app/Info.plist`));
        assert(entries.includes(`${result.prefix}/build-proof.json`));
        assert(entries.includes(`${result.prefix}/UAT-MOBILE.md`));
        assert.equal(proof.target, "ios");
        assert.equal(proof.packageType, "unsigned-device-archive");
        assert.equal(proof.sdk, "iphoneos");
        assert.equal(proof.codeSigningAllowed, false);
        assert.equal(proof.deviceInstallable, false);

        console.log(`Proof ios-device-archive-package:${version}: unsigned iphoneos MeshDrop.xcarchive built and inspected`);
    }
    finally {
        await fs.rm(outDir, {recursive: true, force: true});
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
