import {execFile} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {buildDesktopChromiumPackage} from "./build-desktop-package.mjs";
import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const defaultSigner = "MeshDrop Desktop UAT Signing <desktop-uat@meshdrop.local>";

export function parseArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist"),
        bundleChromium: true
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
        else if (argv[i] === "--chromium-bundle-path") {
            args.chromiumBundlePath = argv[i + 1];
            i += 1;
        }
        else if (argv[i] === "--gpg-key") {
            args.gpgKey = argv[i + 1];
            i += 1;
        }
        else if (argv[i] === "--no-bundle-chromium") {
            args.bundleChromium = false;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

export async function buildDesktopInstaller(options = {}) {
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const packageResult = await buildDesktopChromiumPackage({
        ...options,
        version,
        outDir,
        bundleChromium: options.bundleChromium !== false
    });

    if (!packageResult.chromiumEngineBundled) {
        throw new Error("Desktop installer requires a bundled Chromium engine");
    }

    await fs.mkdir(outDir, {recursive: true});

    const installerName = `meshdrop-desktop-chromium-bundled-installer-${version}.run`;
    const installerPath = path.join(outDir, installerName);
    const payload = await fs.readFile(packageResult.artifactPath);
    const payloadSha256 = sha256(payload);
    const metadata = {
        schemaVersion: 1,
        name: "meshdrop-desktop-chromium-bundled-installer",
        version,
        target: "desktop",
        platform: "linux",
        package: path.basename(packageResult.artifactPath),
        payloadPrefix: packageResult.prefix,
        payloadSha256,
        installs: {
            launcher: "bin/meshdrop-desktop-chromium",
            appRoot: "app",
            symlink: "meshdrop-desktop"
        },
        signature: "gpg-detached-armor",
        remainingProof: []
    };

    await writeInstaller(installerPath, metadata, payload);
    const installerSha256 = sha256(await fs.readFile(installerPath));
    const sha256Path = `${installerPath}.sha256`;
    await fs.writeFile(sha256Path, `${installerSha256}  ${path.basename(installerPath)}\n`);
    const signing = await signInstaller(installerPath, outDir, options);

    return {
        ...packageResult,
        installerPath,
        installerName,
        sha256Path,
        signaturePath: signing.signaturePath,
        publicKeyPath: signing.publicKeyPath,
        signingKey: signing.signingKey,
        metadata,
        installerSha256
    };
}

async function writeInstaller(installerPath, metadata, payload) {
    const header = [
        "#!/bin/sh",
        "set -eu",
        `prefix='${metadata.payloadPrefix}'`,
        "",
        "if [ \"${1:-}\" = \"--print-metadata\" ]; then",
        "cat <<'MESHDROP_METADATA'",
        JSON.stringify(metadata, null, 2),
        "MESHDROP_METADATA",
        "exit 0",
        "fi",
        "",
        "install_dir=\"${1:-${HOME}/.local/share/meshdrop-desktop}\"",
        "bin_dir=\"${MESHDROP_INSTALL_BIN_DIR:-${HOME}/.local/bin}\"",
        "mkdir -p \"${install_dir}\" \"${bin_dir}\"",
        "payload_line=$(awk '/^__MESHDROP_PAYLOAD_BELOW__$/ { print NR + 1; exit 0; }' \"$0\")",
        "if [ -z \"${payload_line}\" ]; then",
        "  echo \"MeshDrop installer payload marker missing\" >&2",
        "  exit 1",
        "fi",
        "tail -n +\"${payload_line}\" \"$0\" | tar -xzf - -C \"${install_dir}\"",
        "ln -sf \"${install_dir}/${prefix}/bin/meshdrop-desktop-chromium\" \"${bin_dir}/meshdrop-desktop\"",
        "printf '%s\\n' \"Installed MeshDrop Desktop to ${install_dir}/${prefix}\"",
        "printf '%s\\n' \"Launcher symlink: ${bin_dir}/meshdrop-desktop\"",
        "exit 0",
        "__MESHDROP_PAYLOAD_BELOW__",
        ""
    ].join("\n");

    await fs.writeFile(installerPath, Buffer.concat([Buffer.from(header), payload]));
    await fs.chmod(installerPath, 0o755);
}

async function signInstaller(installerPath, outDir, options = {}) {
    const env = options.env || process.env;
    const gpgHome = env.GNUPGHOME || await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-gpg-"));
    const gpgEnv = {...env, GNUPGHOME: gpgHome};
    let signingKey = options.gpgKey || env.MESHDROP_DESKTOP_GPG_KEY || "";

    await fs.mkdir(gpgHome, {recursive: true, mode: 0o700});
    await fs.chmod(gpgHome, 0o700);

    if (!signingKey) {
        await run("gpg", [
            "--batch",
            "--pinentry-mode",
            "loopback",
            "--passphrase",
            "",
            "--quick-generate-key",
            defaultSigner,
            "default",
            "sign",
            "0"
        ], {env: gpgEnv});
        signingKey = await firstSecretFingerprint(gpgEnv);
    }

    const signaturePath = `${installerPath}.asc`;
    const publicKeyPath = path.join(outDir, `${path.basename(installerPath)}.pubkey.asc`);

    await fs.rm(signaturePath, {force: true});
    await fs.rm(publicKeyPath, {force: true});
    await run("gpg", [
        "--batch",
        "--yes",
        "--armor",
        "--detach-sign",
        "--local-user",
        signingKey,
        "--output",
        signaturePath,
        installerPath
    ], {env: gpgEnv});
    const {stdout} = await run("gpg", [
        "--batch",
        "--yes",
        "--armor",
        "--export",
        signingKey
    ], {env: gpgEnv});
    await fs.writeFile(publicKeyPath, stdout);

    return {signaturePath, publicKeyPath, signingKey};
}

async function firstSecretFingerprint(env) {
    const {stdout} = await run("gpg", ["--batch", "--with-colons", "--list-secret-keys"], {env});
    const fingerprint = stdout.split("\n")
        .find(line => line.startsWith("fpr:"))
        ?.split(":")[9];
    if (!fingerprint) throw new Error("Generated GPG key has no fingerprint");
    return fingerprint;
}

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {env: options.env || process.env}, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}\n${stderr}`;
                reject(error);
                return;
            }
            resolve({stdout, stderr});
        });
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const result = await buildDesktopInstaller(parseArgs(process.argv.slice(2)));
    console.log(`Desktop signed installer: ${result.installerPath}`);
    console.log(`Signature: ${result.signaturePath}`);
    console.log(`Public key: ${result.publicKeyPath}`);
}
