import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildMobileNativeSourcePackage} from "./build-mobile-package.mjs";

export async function prepareIosNativeSource({version, smokeName, buildId, env = process.env}) {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `meshdrop-${smokeName}-`));
    const result = await buildMobileNativeSourcePackage({
        target: "ios",
        version,
        outDir: workDir,
        portableArchive: true,
        env: {
            ...env,
            MESH_DROP_BUILD_ID: buildId
        }
    });
    await run("tar", ["-xzf", result.artifactPath, "-C", workDir]);

    const sourceRoot = path.join(workDir, `meshdrop-ios-native-source-${version}`, "native", "ios");
    const projectPath = path.join(sourceRoot, "MeshDrop.xcodeproj");
    await fs.access(path.join(projectPath, "project.pbxproj"));

    return {
        workDir,
        sourceRoot,
        projectPath,
        cleanup: () => fs.rm(workDir, {recursive: true, force: true})
    };
}

export async function runIosSimulatorBuild({projectPath, derivedDataPath, env = process.env}) {
    const args = [
        "-project", projectPath,
        "-scheme", "MeshDrop",
        "-configuration", "Debug",
        "-sdk", "iphonesimulator",
        "-destination", "generic/platform=iOS Simulator"
    ];
    if (derivedDataPath) {
        args.push("-derivedDataPath", derivedDataPath);
    }
    args.push(
        "CODE_SIGNING_ALLOWED=NO",
        "CODE_SIGNING_REQUIRED=NO",
        "CODE_SIGN_IDENTITY=",
        "build"
    );

    await run("xcodebuild", args, {env});
}

export async function runIosDeviceArchiveBuild({projectPath, archivePath, env = process.env}) {
    const args = [
        "-project", projectPath,
        "-scheme", "MeshDrop",
        "-configuration", "Release",
        "-sdk", "iphoneos",
        "-destination", "generic/platform=iOS",
        "-archivePath", archivePath,
        "CODE_SIGNING_ALLOWED=NO",
        "CODE_SIGNING_REQUIRED=NO",
        "CODE_SIGN_IDENTITY=",
        "archive"
    ];

    await run("xcodebuild", args, {env});
}

export function iosSimulatorAppPath(derivedDataPath) {
    return path.join(derivedDataPath, "Build", "Products", "Debug-iphonesimulator", "MeshDrop.app");
}

export function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {maxBuffer: 1024 * 1024 * 20, ...options}, (error, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (error) {
                error.message = `${command} ${args.join(" ")} failed\n${error.message}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}
