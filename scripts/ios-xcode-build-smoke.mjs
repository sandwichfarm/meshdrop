import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildMobileNativeSourcePackage} from "./build-mobile-package.mjs";

async function main() {
    const version = process.env.MESHDROP_IOS_XCODE_SMOKE_VERSION || "0.0.0-xcode-smoke";
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ios-xcode-smoke-"));

    try {
        const result = await buildMobileNativeSourcePackage({
            target: "ios",
            version,
            outDir: workDir,
            portableArchive: true,
            env: {
                ...process.env,
                MESH_DROP_BUILD_ID: "ios-xcode-smoke"
            }
        });
        await run("tar", ["-xzf", result.artifactPath, "-C", workDir]);

        const sourceRoot = path.join(workDir, `meshdrop-ios-native-source-${version}`, "native", "ios");
        const projectPath = path.join(sourceRoot, "MeshDrop.xcodeproj");
        await fs.access(path.join(projectPath, "project.pbxproj"));

        await run("xcodebuild", [
            "-project", projectPath,
            "-scheme", "MeshDrop",
            "-configuration", "Debug",
            "-sdk", "iphonesimulator",
            "-destination", "generic/platform=iOS Simulator",
            "CODE_SIGNING_ALLOWED=NO",
            "CODE_SIGNING_REQUIRED=NO",
            "CODE_SIGN_IDENTITY=",
            "build"
        ]);

        console.log(`Proof ios-xcode-build:${version}: MeshDrop scheme builds for iOS Simulator without code signing`);
    }
    finally {
        await fs.rm(workDir, {recursive: true, force: true});
    }
}

function run(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {maxBuffer: 1024 * 1024 * 20}, (error, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (error) {
                error.message = `${command} ${args.join(" ")} failed\n${error.message}`;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
