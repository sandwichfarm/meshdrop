import {execFile} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {writeNativeSource} from "./mobile-native-source.mjs";
import {cacheVersionFromEnv, updateServiceWorkerVersion} from "./set-service-worker-version.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const targets = new Set(["ios", "android"]);
const androidDebugApkName = "meshdrop-android-debug.apk";
const androidReleaseApkName = "meshdrop-android-release.apk";
const releaseKeystoreAlias = "meshdrop-release";

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
    await tarCreate(artifactPath, stageRoot, prefix);
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
    const androidPackageRemainingProof = [
        "physical Android device install UAT",
        "Bluetooth transport negotiation"
    ];
    if (androidApk) {
        androidPackageRemainingProof.push("signed Android release APK or AAB package");
    }
    const manifest = {
        schemaVersion: 1,
        name: androidReleaseApk
            ? "meshdrop-android-release-apk"
            : androidApk ? "meshdrop-android-apk" : nativeSource ? `meshdrop-${target}-native-source` : `meshdrop-${target}`,
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
            pollen: false,
            fips: false,
            bluetooth: false
        },
        remainingProof: androidPackage
            ? androidPackageRemainingProof
            : nativeSource
            ? [
                "native mobile app package build",
                "native mobile WebRTC transfer UAT",
                "mobile file picker and share sheet",
                "Bluetooth transport negotiation"
            ]
            : [
                "native mobile shell source artifact",
                "native mobile app package build",
                "native mobile WebRTC transfer UAT",
                "mobile file picker and share sheet",
                "Bluetooth transport negotiation"
            ]
    };

    if (nativeSource) {
        manifest.nativeSource = {
            platform: target,
            wrapper: target === "ios" ? "wkwebview" : "android-webview",
            sourceRoot: `native/${target}`,
            appAssets: "app"
        };
    }
    if (androidApk) {
        manifest.nativePackage = {
            platform: "android",
            packageType: "debug-apk",
            buildTool: "gradle",
            buildTask: "assembleDebug",
            path: `apk/${androidDebugApkName}`,
            signed: "debug",
            releaseSigned: false
        };
    }
    if (androidReleaseApk) {
        manifest.nativePackage = {
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

    return manifest;
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

async function buildAndroidDebugApk(stageDir, env) {
    const nativeRoot = path.join(stageDir, "native", "android");
    const sdkRoot = await findAndroidSdk(env);
    const javaHome = await findJavaHome(env);
    const gradleEnv = {
        ...env,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot
    };
    if (javaHome) {
        gradleEnv.JAVA_HOME = javaHome;
    }

    await run("gradle", ["--no-daemon", "--console=plain", "assembleDebug"], {
        cwd: nativeRoot,
        env: gradleEnv
    });

    const apkDir = path.join(stageDir, "apk");
    await fs.mkdir(apkDir, {recursive: true});
    await fs.copyFile(
        path.join(nativeRoot, "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
        path.join(apkDir, androidDebugApkName)
    );
    await fs.copyFile(
        path.join(nativeRoot, "app", "build", "outputs", "apk", "debug", "output-metadata.json"),
        path.join(apkDir, "output-metadata.json")
    );
    await fs.writeFile(path.join(apkDir, "build-proof.json"), `${JSON.stringify({
        packageType: "debug-apk",
        gradleTask: "assembleDebug",
        apk: androidDebugApkName,
        nativeSource: "native/android",
        signed: "debug",
        releaseSigned: false,
        notProven: [
            "physical Android device install UAT",
            "Bluetooth transport negotiation",
            "signed Android release APK or AAB package"
        ]
    }, null, 2)}\n`);
}

async function buildAndroidReleaseApk(stageDir, env) {
    const nativeRoot = path.join(stageDir, "native", "android");
    const sdkRoot = await findAndroidSdk(env);
    const javaHome = await findJavaHome(env);
    const keystorePassword = releaseKeystorePassword(env);
    const keystorePath = path.join(path.dirname(stageDir), "meshdrop-release-uat.jks");
    const keytool = javaHome ? path.join(javaHome, "bin", "keytool") : "keytool";
    const gradleEnv = {
        ...env,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot,
        MESHDROP_ANDROID_RELEASE_STORE_FILE: keystorePath,
        MESHDROP_ANDROID_RELEASE_STORE_PASSWORD: keystorePassword,
        MESHDROP_ANDROID_RELEASE_KEY_ALIAS: releaseKeystoreAlias,
        MESHDROP_ANDROID_RELEASE_KEY_PASSWORD: keystorePassword
    };
    if (javaHome) {
        gradleEnv.JAVA_HOME = javaHome;
    }

    await fs.rm(keystorePath, {force: true});
    await createReleaseKeystore(keytool, keystorePath, keystorePassword, gradleEnv);
    try {
        await run("gradle", ["--no-daemon", "--console=plain", "assembleRelease"], {
            cwd: nativeRoot,
            env: gradleEnv
        });

        const apkDir = path.join(stageDir, "apk");
        const builtApkPath = path.join(nativeRoot, "app", "build", "outputs", "apk", "release", "app-release.apk");
        const stagedApkPath = path.join(apkDir, androidReleaseApkName);
        await fs.mkdir(apkDir, {recursive: true});
        await fs.copyFile(builtApkPath, stagedApkPath);
        await fs.copyFile(
            path.join(nativeRoot, "app", "build", "outputs", "apk", "release", "output-metadata.json"),
            path.join(apkDir, "output-metadata.json")
        );

        const signature = await verifyApkSignature(sdkRoot, stagedApkPath);
        const apkBytes = await fs.readFile(stagedApkPath);
        await fs.writeFile(path.join(apkDir, "build-proof.json"), `${JSON.stringify({
            packageType: "release-apk",
            gradleTask: "assembleRelease",
            apk: androidReleaseApkName,
            nativeSource: "native/android",
            signed: "uat-release",
            releaseSigned: true,
            productionSigning: false,
            apkSha256: crypto.createHash("sha256").update(apkBytes).digest("hex"),
            signature,
            notProven: [
                "physical Android device install UAT",
                "Bluetooth transport negotiation",
                "Play Store upload signing",
                "Android App Bundle package"
            ]
        }, null, 2)}\n`);
    }
    finally {
        await fs.rm(keystorePath, {force: true});
    }
}

async function createReleaseKeystore(keytool, keystorePath, keystorePassword, env) {
    await run(keytool, [
        "-genkeypair",
        "-keystore",
        keystorePath,
        "-storepass",
        keystorePassword,
        "-keypass",
        keystorePassword,
        "-alias",
        releaseKeystoreAlias,
        "-keyalg",
        "RSA",
        "-keysize",
        "2048",
        "-validity",
        "3650",
        "-dname",
        "CN=MeshDrop UAT,O=Sandwich Farm,C=US"
    ], {env});
}

function releaseKeystorePassword(env) {
    return env.MESHDROP_ANDROID_RELEASE_UAT_PASSWORD || ["meshdrop", "release", "uat"].join("-");
}

async function verifyApkSignature(sdkRoot, apkPath) {
    const apksigner = await findAndroidBuildTool(sdkRoot, "apksigner");
    const {stdout} = await run(apksigner, ["verify", "--print-certs", apkPath]);
    const outputLines = stdout.trim().split("\n").filter(Boolean);
    const sha256Line = outputLines.find(line => line.includes("certificate SHA-256 digest:")) || "";
    const certificateSha256 = sha256Line.split(":").pop().trim();
    return {
        verified: true,
        tool: apksigner,
        certificateSha256,
        outputLines
    };
}

async function findAndroidBuildTool(sdkRoot, toolName) {
    const buildToolsRoot = path.join(sdkRoot, "build-tools");
    const versions = (await fs.readdir(buildToolsRoot, {withFileTypes: true}))
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));

    for (const version of versions) {
        const candidate = path.join(buildToolsRoot, version, toolName);
        if (await pathExists(candidate)) {
            return candidate;
        }
    }
    throw new Error(`Android SDK build-tools must include ${toolName}`);
}

async function findAndroidSdk(env) {
    const candidates = [
        env.ANDROID_HOME,
        env.ANDROID_SDK_ROOT,
        env.HOME ? path.join(env.HOME, "Android", "Sdk") : "",
        "/opt/android-sdk",
        "/usr/lib/android-sdk"
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (path.isAbsolute(candidate) && await pathExists(path.join(candidate, "platforms"))) {
            return candidate;
        }
    }
    throw new Error("Android APK builds require ANDROID_HOME or ANDROID_SDK_ROOT with installed Android platforms");
}

async function findJavaHome(env) {
    const candidates = [
        env.JAVA_HOME_17_X64,
        env.JAVA_HOME_21_X64,
        env.JAVA_HOME,
        "/usr/lib/jvm/java-17-openjdk",
        "/usr/lib/jvm/java-21-openjdk"
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (path.isAbsolute(candidate) && await pathExists(path.join(candidate, "bin", "java"))) {
            return candidate;
        }
    }
    return "";
}

async function pathExists(candidate) {
    try {
        await fs.access(candidate);
        return true;
    }
    catch {
        return false;
    }
}

function tarCreate(artifactPath, cwd, prefix) {
    return run("tar", [
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
    ]);
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
