import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {cacheVersionFromEnv, updateServiceWorkerVersion} from "./set-service-worker-version.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

export function parseArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist"),
        native: false
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
        else if (argv[i] === "--native") {
            args.native = true;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

export async function buildDesktopPackage(options = {}) {
    return buildDesktopArtifact({
        ...options,
        native: false
    });
}

export async function buildDesktopNativePackage(options = {}) {
    return buildDesktopArtifact({
        ...options,
        native: true
    });
}

async function buildDesktopArtifact(options = {}) {
    const native = options.native === true;
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = native ? `meshdrop-desktop-linux-${version}` : `meshdrop-desktop-${version}`;
    const stageRoot = path.join(outDir, native ? ".desktop-native-stage" : ".desktop-stage");
    const stageDir = path.join(stageRoot, prefix);
    const appDir = path.join(stageDir, "app");
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(stageDir, {recursive: true});
    await fs.cp(path.join(repoRoot, "public"), appDir, {recursive: true});
    await writeTargetManifest(stageDir, version, native);
    await writeDesktopReadme(stageDir, version, native);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "desktop.md"), path.join(stageDir, "UAT-DESKTOP.md"));
    await stampServiceWorker(appDir, version, options.env || process.env);
    if (native) {
        await compileNativeShell(stageDir);
    }
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix);
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, prefix, version, nativeShellBuilt: native};
}

export async function listTarEntries(artifactPath) {
    const {stdout} = await run("tar", ["-tzf", artifactPath]);
    return stdout.trim().split("\n").filter(Boolean);
}

export async function readTarEntry(artifactPath, entry) {
    const {stdout} = await run("tar", ["-xOf", artifactPath, entry]);
    return stdout;
}

async function writeTargetManifest(stageDir, version, native) {
    const manifest = {
        schemaVersion: 1,
        name: native ? "meshdrop-desktop-linux" : "meshdrop-desktop",
        version,
        target: "desktop",
        appRoot: "app",
        entrypoint: "app/index.html",
        nativeShellBuilt: native,
        uatRunbook: "UAT-DESKTOP.md",
        runtime: {
            target: "desktop",
            platform: "desktop",
            hasBackend: false,
            sharedInstance: false
        },
        transports: {
            localDiscovery: false,
            webrtc: !native,
            nostr: !native,
            blossom: true,
            hashtree: true,
            pollen: false,
            fips: false,
            bluetooth: false
        },
        remainingProof: native
            ? [
                "native engine with RTCPeerConnection support",
                "native desktop WebRTC transfer UAT",
                "desktop installer or signed binary"
            ]
            : [
                "native shell build",
                "native desktop WebRTC transfer UAT",
                "desktop installer or signed binary"
            ]
    };
    if (native) {
        manifest.nativeShell = {
            platform: "linux",
            toolkit: "gtk4-webkitgtk",
            executable: "bin/meshdrop-desktop",
            source: "src/meshdrop-desktop.c"
        };
    }

    await fs.writeFile(path.join(stageDir, "meshdrop-target.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeDesktopReadme(stageDir, version, native) {
    const title = native ? "MeshDrop Desktop Linux Native Artifact" : "MeshDrop Desktop Source Artifact";
    const description = native
        ? "This artifact packages MeshDrop app assets with a compiled Linux GTK/WebKit native shell."
        : "This artifact packages the MeshDrop app assets and target metadata for a future native desktop shell.";
    const nativeNote = native
        ? "Launch command: `bin/meshdrop-desktop --app-dir app`. This GTK/WebKit shell does not claim WebRTC until native engine UAT proves `RTCPeerConnection` support."
        : "It is not a native installer or executable.";
    const text = [
        `# ${title}`,
        "",
        `Version: ${version}`,
        "",
        description,
        nativeNote,
        "",
        "Current entrypoint: `app/index.html`",
        "Target manifest: `meshdrop-target.json`",
        "UAT runbook: `UAT-DESKTOP.md`",
        ""
    ].join("\n");

    await fs.writeFile(path.join(stageDir, "README-DESKTOP.md"), text);
}

async function compileNativeShell(stageDir) {
    const sourcePath = path.join(repoRoot, "packaging", "desktop", "meshdrop-desktop.c");
    const sourceDir = path.join(stageDir, "src");
    const binDir = path.join(stageDir, "bin");
    const stagedSourcePath = path.join(sourceDir, "meshdrop-desktop.c");
    const binaryPath = path.join(binDir, "meshdrop-desktop");
    const flags = await pkgConfigFlags(["gtk4", "webkitgtk-6.0"]);

    await fs.mkdir(sourceDir, {recursive: true});
    await fs.mkdir(binDir, {recursive: true});
    await fs.copyFile(sourcePath, stagedSourcePath);
    await run("cc", [
        stagedSourcePath,
        "-O2",
        "-Wall",
        "-Wextra",
        "-o",
        binaryPath,
        ...flags
    ]);
    await fs.chmod(binaryPath, 0o755);
}

async function pkgConfigFlags(packages) {
    const {stdout} = await run("pkg-config", ["--cflags", "--libs", ...packages]);
    return stdout.trim().split(/\s+/).filter(Boolean);
}

async function stampServiceWorker(appDir, version, env) {
    const serviceWorkerPath = path.join(appDir, "service-worker.js");
    const source = await fs.readFile(serviceWorkerPath, "utf8");
    const cacheVersion = cacheVersionFromEnv({
        ...env,
        MESH_DROP_CACHE_VERSION: env.MESH_DROP_CACHE_VERSION || `desktop-v${version}-${env.MESH_DROP_BUILD_ID || "artifact"}`
    }, version);

    await fs.writeFile(serviceWorkerPath, updateServiceWorkerVersion(source, cacheVersion));
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

function run(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
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
    const args = parseArgs(process.argv.slice(2));
    const result = args.native ? await buildDesktopNativePackage(args) : await buildDesktopPackage(args);
    const kind = args.native ? "Desktop native package" : "Desktop source package";
    console.log(`${kind}: ${result.artifactPath}`);
}
