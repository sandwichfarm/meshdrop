import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";
import {cacheVersionFromEnv, updateServiceWorkerVersion} from "./set-service-worker-version.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
const targets = new Set(["ios", "android"]);

export function parseArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist"),
        target: ""
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
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

export async function buildMobilePackage(options = {}) {
    const target = normalizeTarget(options.target);
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = `meshdrop-${target}-${version}`;
    const stageRoot = path.join(outDir, `.${target}-stage`);
    const stageDir = path.join(stageRoot, prefix);
    const appDir = path.join(stageDir, "app");
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(stageDir, {recursive: true});
    await fs.cp(path.join(repoRoot, "public"), appDir, {recursive: true});
    await writeTargetManifest(stageDir, target, version);
    await writeMobileReadme(stageDir, target, version);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "mobile.md"), path.join(stageDir, "UAT-MOBILE.md"));
    await stampServiceWorker(appDir, target, version, options.env || process.env);
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix);
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, prefix, target, version};
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

async function writeTargetManifest(stageDir, target, version) {
    const manifest = {
        schemaVersion: 1,
        name: `meshdrop-${target}`,
        version,
        target,
        appRoot: "app",
        entrypoint: "app/index.html",
        nativeShellBuilt: false,
        uatRunbook: "UAT-MOBILE.md",
        runtime: {
            target,
            platform: "mobile",
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
            fips: false,
            bluetooth: false
        },
        remainingProof: [
            "native mobile shell build",
            "mobile WebRTC transfer UAT",
            "mobile file picker and share sheet",
            "Bluetooth transport negotiation"
        ]
    };

    await fs.writeFile(path.join(stageDir, "meshdrop-target.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeMobileReadme(stageDir, target, version) {
    const platform = target === "ios" ? "iOS" : "Android";
    const text = [
        `# MeshDrop ${platform} Source Artifact`,
        "",
        `Version: ${version}`,
        "",
        `This artifact packages MeshDrop app assets and target metadata for a future ${platform} native shell.`,
        "It is not a signed mobile app, app-store package, or native executable.",
        "",
        "Current entrypoint: `app/index.html`",
        "Target manifest: `meshdrop-target.json`",
        "UAT runbook: `UAT-MOBILE.md`",
        ""
    ].join("\n");

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
    const result = await buildMobilePackage(parseArgs(process.argv.slice(2)));
    console.log(`${result.target} source package: ${result.artifactPath}`);
}
