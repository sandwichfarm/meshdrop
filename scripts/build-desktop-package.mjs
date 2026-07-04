import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {cacheVersionFromEnv, updateServiceWorkerVersion} from "./set-service-worker-version.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const modes = new Set(["source", "native", "chromium"]);

export function parseArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist"),
        mode: "source",
        native: false,
        chromium: false
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
            args.mode = "native";
            args.native = true;
        }
        else if (argv[i] === "--chromium-shell") {
            args.mode = "chromium";
            args.chromium = true;
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
        mode: "source"
    });
}

export async function buildDesktopNativePackage(options = {}) {
    return buildDesktopArtifact({
        ...options,
        mode: "native"
    });
}

export async function buildDesktopChromiumPackage(options = {}) {
    return buildDesktopArtifact({
        ...options,
        mode: "chromium"
    });
}

async function buildDesktopArtifact(options = {}) {
    const mode = normalizeMode(options.mode || (options.native ? "native" : "source"));
    const native = mode === "native";
    const chromium = mode === "chromium";
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = artifactPrefix(mode, version);
    const stageRoot = path.join(outDir, `.${prefix}-stage`);
    const stageDir = path.join(stageRoot, prefix);
    const appDir = path.join(stageDir, "app");
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(stageDir, {recursive: true});
    await fs.cp(path.join(repoRoot, "public"), appDir, {recursive: true});
    await writeTargetManifest(stageDir, version, mode);
    await writeDesktopReadme(stageDir, version, mode);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "desktop.md"), path.join(stageDir, "UAT-DESKTOP.md"));
    await stampServiceWorker(appDir, version, options.env || process.env);
    if (native) {
        await compileNativeShell(stageDir);
    }
    if (chromium) {
        await writeChromiumShell(stageDir);
    }
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix);
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, prefix, version, nativeShellBuilt: native || chromium, mode};
}

export async function listTarEntries(artifactPath) {
    const {stdout} = await run("tar", ["-tzf", artifactPath]);
    return stdout.trim().split("\n").filter(Boolean);
}

export async function readTarEntry(artifactPath, entry) {
    const {stdout} = await run("tar", ["-xOf", artifactPath, entry]);
    return stdout;
}

function normalizeMode(mode) {
    if (!modes.has(mode)) throw new Error(`Unknown desktop artifact mode: ${mode}`);
    return mode;
}

function artifactPrefix(mode, version) {
    if (mode === "native") return `meshdrop-desktop-linux-${version}`;
    if (mode === "chromium") return `meshdrop-desktop-chromium-${version}`;
    return `meshdrop-desktop-${version}`;
}

async function writeTargetManifest(stageDir, version, mode) {
    const native = mode === "native";
    const chromium = mode === "chromium";
    const manifest = {
        schemaVersion: 1,
        name: manifestName(mode),
        version,
        target: "desktop",
        appRoot: "app",
        entrypoint: "app/index.html",
        nativeShellBuilt: native || chromium,
        chromiumShellBuilt: chromium,
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
            : chromium
                ? [
                    "bundled Chromium engine or installer",
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
    if (chromium) {
        manifest.nativeShell = {
            platform: "linux",
            toolkit: "chromium",
            executable: "bin/meshdrop-desktop-chromium.mjs",
            source: "src/meshdrop-desktop-chromium.mjs"
        };
    }

    await fs.writeFile(path.join(stageDir, "meshdrop-target.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function manifestName(mode) {
    if (mode === "native") return "meshdrop-desktop-linux";
    if (mode === "chromium") return "meshdrop-desktop-chromium";
    return "meshdrop-desktop";
}

async function writeDesktopReadme(stageDir, version, mode) {
    const title = desktopTitle(mode);
    const description = desktopDescription(mode);
    const nativeNote = desktopNote(mode);
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

function desktopTitle(mode) {
    if (mode === "native") return "MeshDrop Desktop Linux Native Artifact";
    if (mode === "chromium") return "MeshDrop Desktop Chromium Shell Artifact";
    return "MeshDrop Desktop Source Artifact";
}

function desktopDescription(mode) {
    if (mode === "native") return "This artifact packages MeshDrop app assets with a compiled Linux GTK/WebKit native shell.";
    if (mode === "chromium") return "This artifact packages MeshDrop app assets with a Chromium-backed desktop shell.";
    return "This artifact packages the MeshDrop app assets and target metadata for a future native desktop shell.";
}

function desktopNote(mode) {
    if (mode === "native") {
        return [
            "Launch command: `bin/meshdrop-desktop --app-dir app`.",
            "This GTK/WebKit shell does not claim WebRTC until native engine UAT proves `RTCPeerConnection` support."
        ].join(" ");
    }
    if (mode === "chromium") {
        return "Launch command: `node bin/meshdrop-desktop-chromium.mjs --app-dir app`. Requires an installed Chromium-compatible browser.";
    }
    return "It is not a native installer or executable.";
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

async function writeChromiumShell(stageDir) {
    const sourcePath = path.join(repoRoot, "packaging", "desktop", "meshdrop-desktop-chromium.mjs");
    const sourceDir = path.join(stageDir, "src");
    const binDir = path.join(stageDir, "bin");
    const stagedSourcePath = path.join(sourceDir, "meshdrop-desktop-chromium.mjs");
    const launcherPath = path.join(binDir, "meshdrop-desktop-chromium.mjs");

    await fs.mkdir(sourceDir, {recursive: true});
    await fs.mkdir(binDir, {recursive: true});
    await fs.copyFile(sourcePath, stagedSourcePath);
    await fs.copyFile(sourcePath, launcherPath);
    await fs.chmod(launcherPath, 0o755);
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
    const result = args.mode === "native"
        ? await buildDesktopNativePackage(args)
        : args.mode === "chromium"
            ? await buildDesktopChromiumPackage(args)
            : await buildDesktopPackage(args);
    const kind = args.mode === "native"
        ? "Desktop native package"
        : args.mode === "chromium"
            ? "Desktop Chromium shell package"
            : "Desktop source package";
    console.log(`${kind}: ${result.artifactPath}`);
}
