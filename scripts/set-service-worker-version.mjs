import {execSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const serviceWorkerPath = "public/service-worker.js";

export function gitRef(env = process.env) {
    if (env.MESH_DROP_COMMIT) return env.MESH_DROP_COMMIT;

    try {
        return execSync("git rev-parse --short=12 HEAD", {stdio: ["ignore", "pipe", "ignore"]})
            .toString()
            .trim();
    } catch {
        return "nogit";
    }
}

export function buildStamp(env = process.env) {
    if (env.MESH_DROP_BUILD_ID) return env.MESH_DROP_BUILD_ID;
    if (env.SOURCE_DATE_EPOCH) {
        return new Date(Number(env.SOURCE_DATE_EPOCH) * 1000).toISOString();
    }

    return new Date().toISOString();
}

export function sanitizeVersion(value) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function cacheVersionFromEnv(env = process.env, version = packageJson.version) {
    return sanitizeVersion(
        env.MESH_DROP_CACHE_VERSION
            || `v${version}-${gitRef(env)}-${buildStamp(env)}`
    );
}

export function updateServiceWorkerVersion(source, cacheVersion) {
    const updated = source.replace(
        /const cacheVersion = '[^']+';/,
        `const cacheVersion = '${cacheVersion}';`
    );

    if (source === updated) {
        throw new Error("Could not find cacheVersion declaration");
    }

    return updated;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const cacheVersion = cacheVersionFromEnv();
    const source = fs.readFileSync(serviceWorkerPath, "utf8");
    const updated = updateServiceWorkerVersion(source, cacheVersion);

    fs.writeFileSync(serviceWorkerPath, updated);
    console.log(`Service worker cache version: ${cacheVersion}`);
}
