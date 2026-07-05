import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {
    prepareIosNativeSource,
    run,
    runIosDeviceArchiveBuild
} from "./ios-xcode-smoke-helpers.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

export function parseIosDeviceArchiveArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist")
    };

    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--version") {
            args.version = argv[i + 1];
            i += 1;
        }
        else if (argv[i] === "--out-dir") {
            args.outDir = argv[i + 1];
            i += 1;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

export async function buildIosDeviceArchivePackage(options = {}) {
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = `meshdrop-ios-device-archive-${version}`;
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);
    const prepared = await prepareIosNativeSource({
        version,
        smokeName: "ios-device-archive-package",
        buildId: "ios-device-archive-package",
        env: options.env || process.env
    });

    try {
        const archivePath = path.join(prepared.workDir, "MeshDrop.xcarchive");
        await runIosDeviceArchiveBuild({
            projectPath: prepared.projectPath,
            archivePath,
            env: options.env || process.env
        });
        await fs.access(path.join(archivePath, "Info.plist"));
        await fs.access(path.join(archivePath, "Products", "Applications", "MeshDrop.app", "Info.plist"));

        const stageRoot = path.join(outDir, ".ios-device-archive-stage");
        const stageDir = path.join(stageRoot, prefix);
        await fs.rm(stageRoot, {recursive: true, force: true});
        await fs.mkdir(stageDir, {recursive: true});
        await fs.cp(archivePath, path.join(stageDir, "MeshDrop.xcarchive"), {recursive: true});
        await fs.writeFile(path.join(stageDir, "build-proof.json"), `${JSON.stringify({
            schemaVersion: 1,
            target: "ios",
            packageType: "unsigned-device-archive",
            xcodeProject: "MeshDrop.xcodeproj",
            scheme: "MeshDrop",
            sdk: "iphoneos",
            destination: "generic/platform=iOS",
            configuration: "Release",
            codeSigningAllowed: false,
            deviceInstallable: false,
            appStoreReady: false,
            archiveBundle: "MeshDrop.xcarchive",
            remainingProof: [
                "signed/device-installable iOS package",
                "App Group entitlement provisioning",
                "iOS device file-picker UAT",
                "iOS share-sheet device UAT",
                "native iOS WebRTC transfer UAT"
            ]
        }, null, 2)}\n`);
        await fs.copyFile(path.join(repoRoot, "docs", "uat", "mobile.md"), path.join(stageDir, "UAT-MOBILE.md"));
        await fs.rm(artifactPath, {force: true});
        await run("tar", ["-czf", artifactPath, "-C", stageRoot, prefix]);
        await fs.rm(stageRoot, {recursive: true, force: true});

        return {artifactPath, prefix, version, packageType: "unsigned-device-archive"};
    }
    finally {
        await prepared.cleanup();
    }
}

async function main() {
    const args = parseIosDeviceArchiveArgs(process.argv.slice(2));
    const result = await buildIosDeviceArchivePackage(args);
    console.log(`Built ${result.artifactPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}
