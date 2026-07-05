import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {
    iosSimulatorAppPath,
    prepareIosNativeSource,
    run,
    runIosSimulatorBuild
} from "./ios-xcode-smoke-helpers.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

export function parseIosSimulatorAppArgs(argv) {
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

export async function buildIosSimulatorAppPackage(options = {}) {
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = `meshdrop-ios-simulator-app-${version}`;
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);
    const prepared = await prepareIosNativeSource({
        version,
        smokeName: "ios-simulator-app-package",
        buildId: "ios-simulator-app-package",
        env: options.env || process.env
    });

    try {
        const derivedDataPath = path.join(prepared.workDir, "DerivedData");
        await runIosSimulatorBuild({
            projectPath: prepared.projectPath,
            derivedDataPath,
            env: options.env || process.env
        });

        const appPath = iosSimulatorAppPath(derivedDataPath);
        await fs.access(path.join(appPath, "Info.plist"));

        const stageRoot = path.join(outDir, ".ios-simulator-app-stage");
        const stageDir = path.join(stageRoot, prefix);
        await fs.rm(stageRoot, {recursive: true, force: true});
        await fs.mkdir(stageDir, {recursive: true});
        await fs.cp(appPath, path.join(stageDir, "MeshDrop.app"), {recursive: true});
        await fs.writeFile(path.join(stageDir, "build-proof.json"), `${JSON.stringify({
            schemaVersion: 1,
            target: "ios",
            packageType: "unsigned-simulator-app",
            xcodeProject: "MeshDrop.xcodeproj",
            scheme: "MeshDrop",
            sdk: "iphonesimulator",
            configuration: "Debug",
            codeSigningAllowed: false,
            appBundle: "MeshDrop.app",
            remainingProof: [
                "signed/device-installable iOS package",
                "App Group entitlement provisioning",
                "iOS device file-picker UAT",
                "iOS share-sheet device UAT",
                "native iOS WebRTC transfer UAT",
                "Bluetooth transport negotiation"
            ]
        }, null, 2)}\n`);
        await fs.copyFile(path.join(repoRoot, "docs", "uat", "mobile.md"), path.join(stageDir, "UAT-MOBILE.md"));
        await fs.rm(artifactPath, {force: true});
        await run("tar", ["-czf", artifactPath, "-C", stageRoot, prefix]);
        await fs.rm(stageRoot, {recursive: true, force: true});

        return {artifactPath, prefix, version, packageType: "unsigned-simulator-app"};
    }
    finally {
        await prepared.cleanup();
    }
}

async function main() {
    const args = parseIosSimulatorAppArgs(process.argv.slice(2));
    const result = await buildIosSimulatorAppPackage(args);
    console.log(`Built ${result.artifactPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}
