import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

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

export function sanitizeArtifactPart(value) {
    const sanitized = `${value}`
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!sanitized) throw new Error("Artifact version cannot be empty");
    return sanitized;
}

export async function buildSpaArtifact(options = {}) {
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const prefix = `meshdrop-spa-${version}`;
    const stageRoot = path.join(outDir, ".spa-stage");
    const stageDir = path.join(stageRoot, prefix);
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(outDir, {recursive: true});
    await fs.cp(path.join(repoRoot, "public"), stageDir, {recursive: true});
    await writeTargetManifest(stageDir, version);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "spa.md"), path.join(stageDir, "UAT-SPA.md"));
    await stampServiceWorker(stageDir, version, options.env || process.env);
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix);
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, prefix, version};
}

async function writeTargetManifest(stageDir, version) {
    const manifest = {
        schemaVersion: 1,
        name: "meshdrop-spa",
        version,
        target: "spa",
        entrypoint: "index.html",
        uatRunbook: "UAT-SPA.md",
        runtime: {
            target: "spa",
            platform: "browser",
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
        }
    };

    await fs.writeFile(
        path.join(stageDir, "meshdrop-target.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
    );
}

async function stampServiceWorker(stageDir, version, env) {
    const serviceWorkerPath = path.join(stageDir, "service-worker.js");
    const source = await fs.readFile(serviceWorkerPath, "utf8");
    const cacheVersion = cacheVersionFromEnv({
        ...env,
        MESH_DROP_CACHE_VERSION: env.MESH_DROP_CACHE_VERSION || `spa-v${version}-${env.MESH_DROP_BUILD_ID || "artifact"}`
    }, version);

    await fs.writeFile(serviceWorkerPath, updateServiceWorkerVersion(source, cacheVersion));
}

export async function listTarEntries(artifactPath) {
    const {stdout} = await run("tar", ["-tzf", artifactPath]);
    return stdout.trim().split("\n").filter(Boolean);
}

function tarCreate(artifactPath, cwd, prefix) {
    return run("tar", ["-czf", artifactPath, "-C", cwd, prefix]);
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
    const result = await buildSpaArtifact(parseArgs(process.argv.slice(2)));
    console.log(`SPA artifact: ${result.artifactPath}`);
}
