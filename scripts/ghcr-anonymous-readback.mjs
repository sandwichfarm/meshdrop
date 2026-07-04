import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const targets = ["standalone", "start9", "umbrel"];

async function main() {
    const tag = parseTag(process.argv.slice(2));
    const version = tag.slice(1);
    const imageBase = process.env.MESHDROP_GHCR_IMAGE_BASE || "ghcr.io/sandwichfarm/meshdrop";
    const dockerConfig = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-ghcr-anon-"));

    try {
        for (const target of targets) {
            for (const prefix of [tag, version]) {
                const image = `${imageBase}:${prefix}-${target}`;
                const manifest = await run("docker", ["manifest", "inspect", image], {
                    env: {DOCKER_CONFIG: dockerConfig}
                });

                assertManifestPlatform(manifest, image, "amd64");
                assertManifestPlatform(manifest, image, "arm64");
                console.log(`Proof ghcr-anonymous:${prefix}-${target}: linux/amd64 linux/arm64`);
            }
        }
    }
    finally {
        await fs.rm(dockerConfig, {recursive: true, force: true});
    }
}

function parseTag(args) {
    const tag = args[0] || process.env.MESHDROP_RELEASE_TAG || "";
    if (!/^v0\.\d+\.\d+$/.test(tag)) {
        throw new Error("Usage: npm run verify:ghcr-anonymous -- v0.x.y");
    }
    return tag;
}

function assertManifestPlatform(manifest, image, architecture) {
    const payload = JSON.parse(manifest);
    const found = payload.manifests?.some(entry => {
        return entry.platform?.os === "linux" && entry.platform?.architecture === architecture;
    });
    if (!found) throw new Error(`${image} does not expose linux/${architecture}`);
}

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            env: {...process.env, ...options.env},
            maxBuffer: 1024 * 1024 * 10
        }, (error, stdout, stderr) => {
            if (error) {
                error.message = `${command} ${args.join(" ")} failed\n${stderr || error.message}`;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
