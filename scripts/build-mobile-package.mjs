import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
    androidDebugApkName,
    androidReleaseApkName,
    buildAndroidDebugApk,
    buildAndroidReleaseApk
} from "./android-package-build.mjs";
import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {writeNativeSource} from "./mobile-native-source.mjs";
import {cacheVersionFromEnv, updateServiceWorkerVersion} from "./set-service-worker-version.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const targets = new Set(["ios", "android"]);

export function parseArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist"),
        target: "",
        nativeSource: false,
        androidApk: false,
        androidReleaseApk: false
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
        else if (argv[i] === "--target") {
            args.target = argv[i + 1];
            i += 1;
        }
        else if (argv[i] === "--native-source") {
            args.nativeSource = true;
        }
        else if (argv[i] === "--android-apk") {
            args.androidApk = true;
        }
        else if (argv[i] === "--android-release-apk") {
            args.androidReleaseApk = true;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

export async function buildMobilePackage(options = {}) {
    return buildMobileArtifact({
        ...options,
        nativeSource: false
    });
}

export async function buildMobileNativeSourcePackage(options = {}) {
    return buildMobileArtifact({
        ...options,
        nativeSource: true
    });
}

export async function buildAndroidApkPackage(options = {}) {
    return buildMobileArtifact({
        ...options,
        target: "android",
        androidApk: true
    });
}

export async function buildAndroidReleaseApkPackage(options = {}) {
    return buildMobileArtifact({
        ...options,
        target: "android",
        androidReleaseApk: true
    });
}

async function buildMobileArtifact(options = {}) {
    const target = normalizeTarget(options.target);
    const androidApk = options.androidApk === true;
    const androidReleaseApk = options.androidReleaseApk === true;
    if (androidApk && androidReleaseApk) {
        throw new Error("Choose either --android-apk or --android-release-apk");
    }
    const androidPackage = androidApk || androidReleaseApk;
    if (androidPackage && target !== "android") {
        throw new Error("Android APK builds require --target android");
    }
    const nativeSource = options.nativeSource === true || androidPackage;
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = artifactPrefix(target, version, nativeSource, androidApk, androidReleaseApk);
    const stageRoot = path.join(outDir, stageName(target, nativeSource, androidApk, androidReleaseApk));
    const stageDir = path.join(stageRoot, prefix);
    const appDir = path.join(stageDir, "app");
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(stageDir, {recursive: true});
    await fs.cp(path.join(repoRoot, "public"), appDir, {recursive: true});
    const manifest = createTargetManifest(target, version, nativeSource, androidApk, androidReleaseApk);
    await writeTargetManifest(stageDir, manifest);
    await writeMobileReadme(stageDir, target, version, nativeSource, androidApk, androidReleaseApk);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "mobile.md"), path.join(stageDir, "UAT-MOBILE.md"));
    await stampServiceWorker(appDir, target, version, options.env || process.env);
    if (nativeSource) {
        await writeNativeSource(stageDir, target, manifest);
    }
    if (androidApk) {
        await buildAndroidDebugApk(stageDir, options.env || process.env);
    }
    if (androidReleaseApk) {
        await buildAndroidReleaseApk(stageDir, options.env || process.env);
    }
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix, {portable: options.portableArchive === true});
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, prefix, target, version, nativeSource, androidApk, androidReleaseApk};
}

export async function listTarEntries(artifactPath) {
    const {stdout} = await run("tar", ["-tzf", artifactPath]);
    return stdout.trim().split("\n").filter(Boolean);
}

export async function readTarEntry(artifactPath, entry) {
    const {stdout} = await run("tar", ["-xOf", artifactPath, entry]);
    return stdout;
}

function normalizeTarget(target) {
    if (!targets.has(target)) {
        throw new Error("Mobile target must be ios or android");
    }
    return target;
}

function artifactPrefix(target, version, nativeSource, androidApk, androidReleaseApk) {
    if (androidReleaseApk) {
        return `meshdrop-android-release-apk-${version}`;
    }
    if (androidApk) {
        return `meshdrop-android-apk-${version}`;
    }
    return nativeSource ? `meshdrop-${target}-native-source-${version}` : `meshdrop-${target}-${version}`;
}

function stageName(target, nativeSource, androidApk, androidReleaseApk) {
    if (androidReleaseApk) {
        return ".android-release-apk-stage";
    }
    if (androidApk) {
        return ".android-apk-stage";
    }
    return nativeSource ? `.${target}-native-source-stage` : `.${target}-stage`;
}

function createTargetManifest(target, version, nativeSource, androidApk, androidReleaseApk) {
    const androidPackage = androidApk || androidReleaseApk;
    const nativeRuntimeTransfersProven = !nativeSource || androidPackage;
    const androidPackagedRuntime = target === "android" && androidPackage;
    const manifest = {
        schemaVersion: 1,
        name: manifestName(target, nativeSource, androidApk, androidReleaseApk),
        version,
        target,
        appRoot: "app",
        entrypoint: "app/index.html",
        nativeShellBuilt: androidPackage,
        nativeShellSourceBuilt: nativeSource,
        uatRunbook: "UAT-MOBILE.md",
        runtime: {
            target,
            platform: "mobile",
            hasBackend: false,
            sharedInstance: false
        },
        transports: {
            localDiscovery: false,
            webrtc: nativeRuntimeTransfersProven,
            nostr: nativeRuntimeTransfersProven,
            blossom: true,
            hashtree: true,
            pollen: androidPackagedRuntime,
            fips: androidPackagedRuntime,
            bluetooth: false
        },
        capabilities: capabilitiesFor(target, nativeSource),
        remainingProof: remainingProofFor(target, nativeSource, androidApk, androidPackage)
    };

    if (nativeSource) {
        manifest.nativeSource = {
            platform: target,
            wrapper: target === "ios" ? "wkwebview" : "android-webview",
            sourceRoot: `native/${target}`,
            appAssets: "app"
        };
    }
    if (androidPackage) {
        manifest.nativePackage = nativePackageFor(androidReleaseApk);
    }

    return manifest;
}

function manifestName(target, nativeSource, androidApk, androidReleaseApk) {
    if (androidReleaseApk) return "meshdrop-android-release-apk";
    if (androidApk) return "meshdrop-android-apk";
    return nativeSource ? `meshdrop-${target}-native-source` : `meshdrop-${target}`;
}

function capabilitiesFor(target, nativeSource) {
    if (target !== "ios" || !nativeSource) return undefined;

    return {
        transports: {
            bluetooth: {
                supported: false,
                transferSupported: false,
                apiAvailable: false,
                nativeBridgeAvailable: false,
                unavailableReason: "bluetooth-transfer-not-implemented"
            }
        }
    };
}

function remainingProofFor(target, nativeSource, androidApk, androidPackage) {
    if (androidPackage) {
        return androidApk
            ? ["physical Android device install UAT", "signed Android release APK or AAB package"]
            : ["physical Android device install UAT"];
    }
    const remaining = [
        "native mobile app package build",
        "native mobile WebRTC transfer UAT",
        "mobile file picker and share sheet",
        "Bluetooth transport negotiation"
    ];
    if (target === "ios" && nativeSource) {
        remaining.pop();
    }
    return nativeSource ? remaining : ["native mobile shell source artifact", ...remaining];
}

function nativePackageFor(androidReleaseApk) {
    if (androidReleaseApk) {
        return {
            platform: "android",
            packageType: "release-apk",
            buildTool: "gradle",
            buildTask: "assembleRelease",
            path: `apk/${androidReleaseApkName}`,
            signed: "uat-release",
            releaseSigned: true,
            productionSigning: false
        };
    }
    return {
        platform: "android",
        packageType: "debug-apk",
        buildTool: "gradle",
        buildTask: "assembleDebug",
        path: `apk/${androidDebugApkName}`,
        signed: "debug",
        releaseSigned: false
    };
}

async function writeTargetManifest(stageDir, manifest) {
    await fs.writeFile(path.join(stageDir, "meshdrop-target.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeMobileReadme(stageDir, target, version, nativeSource, androidApk, androidReleaseApk) {
    const platform = target === "ios" ? "iOS" : "Android";
    const title = androidReleaseApk
        ? "MeshDrop Android Release APK Artifact"
        : androidApk
        ? "MeshDrop Android Debug APK Artifact"
        : nativeSource ? `MeshDrop ${platform} Native Source Artifact` : `MeshDrop ${platform} Source Artifact`;
    const description = androidReleaseApk
        ? "This artifact packages MeshDrop app assets, Android native WebView wrapper source, and a Gradle-built release APK."
        : androidApk
        ? "This artifact packages MeshDrop app assets, Android native WebView wrapper source, and a Gradle-built debug APK."
        : nativeSource
        ? `This artifact packages MeshDrop app assets with ${platform} native WebView wrapper source.`
        : `This artifact packages MeshDrop app assets and target metadata for a future ${platform} native shell.`;
    const packageNote = androidReleaseApk
        ? "It is signed with a generated UAT keystore. It is not Play Store upload signing, AAB proof, or physical-device proof."
        : androidApk
        ? "It is a debug APK for UAT. It is not a signed release APK, AAB, app-store package, or physical-device proof."
        : nativeSource
        ? "It is not a signed app, app-store package, APK, or IPA."
        : "It is not a signed mobile app, app-store package, or native executable.";
    const text = [
        `# ${title}`,
        "",
        `Version: ${version}`,
        "",
        description,
        packageNote,
        "",
        "Current entrypoint: `app/index.html`",
        "Target manifest: `meshdrop-target.json`",
        androidReleaseApk ? `Release APK: \`apk/${androidReleaseApkName}\`` : "",
        androidApk ? `Debug APK: \`apk/${androidDebugApkName}\`` : "",
        "UAT runbook: `UAT-MOBILE.md`",
        nativeSource ? `Native source: \`native/${target}/\`` : "",
        ""
    ].filter(line => line !== "").join("\n");

    await fs.writeFile(path.join(stageDir, `README-${target.toUpperCase()}.md`), text);
}

async function stampServiceWorker(appDir, target, version, env) {
    const serviceWorkerPath = path.join(appDir, "service-worker.js");
    const source = await fs.readFile(serviceWorkerPath, "utf8");
    const cacheVersion = cacheVersionFromEnv({
        ...env,
        MESH_DROP_CACHE_VERSION: env.MESH_DROP_CACHE_VERSION || `${target}-v${version}-${env.MESH_DROP_BUILD_ID || "artifact"}`
    }, version);

    await fs.writeFile(serviceWorkerPath, updateServiceWorkerVersion(source, cacheVersion));
}

function tarCreate(artifactPath, cwd, prefix, options = {}) {
    const args = options.portable === true
        ? ["-czf", artifactPath, "-C", cwd, prefix]
        : [
            "--sort=name",
            "--mtime=UTC 2020-01-01",
            "--owner=0",
            "--group=0",
            "--numeric-owner",
            "-czf",
            artifactPath,
            "-C",
            cwd,
            prefix
        ];
    return run("tar", args);
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {...options, maxBuffer: 1024 * 1024 * 16}, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}\n${stdout}\n${stderr}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const args = parseArgs(process.argv.slice(2));
    const result = args.androidReleaseApk
        ? await buildAndroidReleaseApkPackage(args)
        : args.androidApk
        ? await buildAndroidApkPackage(args)
        : args.nativeSource
        ? await buildMobileNativeSourcePackage(args)
        : await buildMobilePackage(args);
    const kind = args.androidReleaseApk
        ? "release APK package"
        : args.androidApk
        ? "debug APK package"
        : args.nativeSource ? "native source package" : "source package";
    console.log(`${result.target} ${kind}: ${result.artifactPath}`);
}
