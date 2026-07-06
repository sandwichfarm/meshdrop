import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {sanitizeArtifactPart} from "./build-spa-artifact.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

export function parseArgs(argv) {
    const args = {
        version: packageJson.version,
        outDir: path.join(repoRoot, "dist"),
        image: ""
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
        else if (argv[i] === "--image") {
            args.image = argv[i + 1];
            i += 1;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

export async function buildUmbrelPackage(options = {}) {
    const version = sanitizeArtifactPart(options.version || packageJson.version);
    const outDir = path.resolve(options.outDir || path.join(repoRoot, "dist"));
    const image = options.image || `ghcr.io/sandwichfarm/meshdrop:${version}-umbrel`;
    const prefix = `meshdrop-umbrel-${version}`;
    const stageRoot = path.join(outDir, ".umbrel-stage");
    const stageDir = path.join(stageRoot, prefix);
    const artifactPath = path.join(outDir, `${prefix}.tar.gz`);

    await fs.rm(stageRoot, {recursive: true, force: true});
    await fs.mkdir(stageDir, {recursive: true});
    await writeTemplate("umbrel-app.yml", stageDir, {version, image});
    await writeTemplate("docker-compose.yml", stageDir, {version, image});
    await writeTargetManifest(stageDir, version, image);
    await fs.copyFile(path.join(repoRoot, "docs", "uat", "umbrel.md"), path.join(stageDir, "UAT-UMBREL.md"));
    await fs.rm(artifactPath, {force: true});
    await tarCreate(artifactPath, stageRoot, prefix);
    await fs.rm(stageRoot, {recursive: true, force: true});

    return {artifactPath, image, prefix, version};
}

export async function listTarEntries(artifactPath) {
    const {stdout} = await run("tar", ["-tzf", artifactPath]);
    return stdout.trim().split("\n").filter(Boolean);
}

export async function readTarEntry(artifactPath, entry) {
    const {stdout} = await run("tar", ["-xOf", artifactPath, entry]);
    return stdout;
}

async function writeTemplate(fileName, stageDir, values) {
    const sourcePath = path.join(repoRoot, "packaging", "umbrel", fileName);
    const template = await fs.readFile(sourcePath, "utf8");
    const rendered = template
        .replaceAll("__MESHDROP_VERSION__", values.version)
        .replaceAll("__MESHDROP_IMAGE__", values.image);

    await fs.writeFile(path.join(stageDir, fileName), rendered);
}

async function writeTargetManifest(stageDir, version, image) {
    const manifest = {
        schemaVersion: 1,
        name: "meshdrop-umbrel",
        version,
        target: "umbrel",
        image,
        appManifest: "umbrel-app.yml",
        composeFile: "docker-compose.yml",
        uatRunbook: "UAT-UMBREL.md",
        runtime: {
            target: "umbrel",
            platform: "server",
            hasBackend: true
        },
        configuration: {
            adminNpubEnv: "MESHDROP_ADMIN_NPUB",
            discovery: "browser-nostr-wot",
            staticRooms: false
        },
        transports: {
            webrtc: true,
            nostr: true,
            pollen: true,
            fips: false
        }
    };

    await fs.writeFile(path.join(stageDir, "meshdrop-target.json"), `${JSON.stringify(manifest, null, 2)}\n`);
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
    const result = await buildUmbrelPackage(parseArgs(process.argv.slice(2)));
    console.log(`Umbrel package: ${result.artifactPath}`);
}
