import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildIosDeviceAppPackage} from "./build-ios-device-app-package.mjs";
import {listTarEntries, readTarEntry} from "./build-mobile-package.mjs";

async function main() {
    const version = process.env.MESHDROP_IOS_DEVICE_APP_SMOKE_VERSION || "0.0.0-ios-device-app-smoke";
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ios-device-app-smoke-"));

    try {
        const result = await buildIosDeviceAppPackage({version, outDir});
        const entries = await listTarEntries(result.artifactPath);
        const proof = JSON.parse(await readTarEntry(result.artifactPath, `${result.prefix}/build-proof.json`));

        assert(entries.includes(`${result.prefix}/MeshDrop.app/Info.plist`));
        assert(entries.includes(`${result.prefix}/build-proof.json`));
        assert(entries.includes(`${result.prefix}/UAT-MOBILE.md`));
        assert.equal(proof.target, "ios");
        assert.equal(proof.packageType, "unsigned-device-app");
        assert.equal(proof.sdk, "iphoneos");
        assert.equal(proof.codeSigningAllowed, false);
        assert.equal(proof.deviceInstallable, false);

        console.log(`Proof ios-device-app-package:${version}: unsigned iphoneos MeshDrop.app built and inspected`);
    }
    finally {
        await fs.rm(outDir, {recursive: true, force: true});
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
