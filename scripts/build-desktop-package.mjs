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

export async function buildDesktopPackage(options = {}) {
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = `meshdrop-desktop-${version}`;
    const stageRoot = path.join(outDir, ".desktop-stage");
    const stageDir = path.join(stageRoot, prefix);
    const appDir = path.join(stageDir, "app");
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(stageDir, {recursive: true});
    await fs.cp(path.join(repoRoot, "public"), appDir, {recursive: true});
    await writeTargetManifest(stageDir, version);
    await writeDesktopReadme(stageDir, version);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "desktop.md"), path.join(stageDir, "UAT-DESKTOP.md"));
    await stampServiceWorker(appDir, version, options.env || process.env);
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix);
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, prefix, version};
}

export async function listTarEntries(artifactPath) {
    const {stdout} = await run("tar", ["-tzf", artifactPath]);
    return stdout.trim().split("\n").filter(Boolean);
}

export async function readTarEntry(artifactPath, entry) {
    const {stdout} = await run("tar", ["-xOf", artifactPath, entry]);
    return stdout;
}

async function writeTargetManifest(stageDir, version) {
    const manifest = {
        schemaVersion: 1,
        name: "meshdrop-desktop",
        version,
        target: "desktop",
        appRoot: "app",
        entrypoint: "app/index.html",
        nativeShellBuilt: false,
        uatRunbook: "UAT-DESKTOP.md",
        runtime: {
            target: "desktop",
            platform: "desktop",
            hasBackend: false,
            sharedInstance: false
        },
        transports: {
            localDiscovery: false,
            webrtc: true,
            nostr: true,
            blossom: true,
            hashtree: true,
            pollen: false,
            fips: false
        },
        remainingProof: [
            "native shell build",
            "native desktop WebRTC transfer UAT",
            "desktop installer or signed binary"
        ]
    };

    await fs.writeFile(path.join(stageDir, "meshdrop-target.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeDesktopReadme(stageDir, version) {
    const text = [
        "# MeshDrop Desktop Source Artifact",
        "",
        `Version: ${version}`,
        "",
        "This artifact packages the MeshDrop app assets and target metadata for a future native desktop shell.",
        "It is not a native installer or executable.",
        "",
        "Current entrypoint: `app/index.html`",
        "Target manifest: `meshdrop-target.json`",
        "UAT runbook: `UAT-DESKTOP.md`",
        ""
    ].join("\n");

    await fs.writeFile(path.join(stageDir, "README-DESKTOP.md"), text);
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
    const result = await buildDesktopPackage(parseArgs(process.argv.slice(2)));
    console.log(`Desktop source package: ${result.artifactPath}`);
}
