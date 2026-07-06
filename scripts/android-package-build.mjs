import {execFile} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const androidDebugApkName = "meshdrop-android-debug.apk";
export const androidReleaseApkName = "meshdrop-android-release.apk";

const releaseKeystoreAlias = "meshdrop-release";

export async function buildAndroidDebugApk(stageDir, env) {
    const nativeRoot = path.join(stageDir, "native", "android");
    const sdkRoot = await findAndroidSdk(env);
    const javaHome = await findJavaHome(env);
    const gradleEnv = androidGradleEnv(env, sdkRoot, javaHome);

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
            "signed Android release APK or AAB package",
            "native Android Rust FIPS core integration",
            "native Android Pollen WASM/pln integration"
        ]
    }, null, 2)}\n`);
}

export async function buildAndroidReleaseApk(stageDir, env) {
    const nativeRoot = path.join(stageDir, "native", "android");
    const sdkRoot = await findAndroidSdk(env);
    const javaHome = await findJavaHome(env);
    const keystorePassword = releaseKeystorePassword(env);
    const keystorePath = path.join(path.dirname(stageDir), "meshdrop-release-uat.jks");
    const keytool = javaHome ? path.join(javaHome, "bin", "keytool") : "keytool";
    const gradleEnv = androidReleaseGradleEnv(env, sdkRoot, javaHome, keystorePath, keystorePassword);

    await fs.rm(keystorePath, {force: true});
    await createReleaseKeystore(keytool, keystorePath, keystorePassword, gradleEnv);
    try {
        await run("gradle", ["--no-daemon", "--console=plain", "assembleRelease"], {
            cwd: nativeRoot,
            env: gradleEnv
        });
        await stageReleaseApk(stageDir, nativeRoot, sdkRoot);
    }
    finally {
        await fs.rm(keystorePath, {force: true});
    }
}

function androidGradleEnv(env, sdkRoot, javaHome) {
    const gradleEnv = {
        ...env,
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot
    };
    if (javaHome) {
        gradleEnv.JAVA_HOME = javaHome;
    }
    return gradleEnv;
}

function androidReleaseGradleEnv(env, sdkRoot, javaHome, keystorePath, keystorePassword) {
    return {
        ...androidGradleEnv(env, sdkRoot, javaHome),
        MESHDROP_ANDROID_RELEASE_STORE_FILE: keystorePath,
        MESHDROP_ANDROID_RELEASE_STORE_PASSWORD: keystorePassword,
        MESHDROP_ANDROID_RELEASE_KEY_ALIAS: releaseKeystoreAlias,
        MESHDROP_ANDROID_RELEASE_KEY_PASSWORD: keystorePassword
    };
}

async function stageReleaseApk(stageDir, nativeRoot, sdkRoot) {
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
            "native Android Rust FIPS core integration",
            "native Android Pollen WASM/pln integration",
            "Play Store upload signing",
            "Android App Bundle package"
        ]
    }, null, 2)}\n`);
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
