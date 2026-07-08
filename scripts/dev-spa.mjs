import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildSpaArtifact} from "./build-spa-artifact.mjs";
import {run, startStaticServer} from "./spa-smoke-support.mjs";

const defaultPort = 4173;
const fallbackAttempts = 20;

const args = parseArgs(process.argv.slice(2));
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-spa-dev-"));
let server = null;

try {
    const result = await buildSpaArtifact({
        outDir: tempDir,
        env: {
            ...process.env,
            MESH_DROP_BUILD_ID: process.env.MESH_DROP_BUILD_ID || `spa-dev-${Date.now()}`
        }
    });
    const unpackDir = path.join(tempDir, "unpacked");
    await fs.mkdir(unpackDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

    const root = path.join(unpackDir, result.prefix);
    server = await startSpaDevServer(root, args);
    const url = `http://${displayHost(server.host)}:${server.port}`;

    console.log(`SPA dev server: ${url}`);
    console.log(`SPA artifact root: ${root}`);
    console.log("Press Ctrl-C to stop.");

    await waitForShutdown();
}
finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await fs.rm(tempDir, {recursive: true, force: true});
}

function parseArgs(argv) {
    const options = {
        host: process.env.MESHDROP_SPA_DEV_HOST || "127.0.0.1",
        port: process.env.MESHDROP_SPA_DEV_PORT || process.env.PORT || defaultPort
    };

    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--host") {
            options.host = argv[i + 1];
            i += 1;
        }
        else if (argv[i] === "--port") {
            options.port = argv[i + 1];
            i += 1;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return options;
}

async function startSpaDevServer(root, options) {
    const preferredPort = normalizePort(options.port);
    const ports = preferredPort === 0
        ? [0]
        : Array.from({length: fallbackAttempts + 1}, (_, index) => preferredPort + index)
            .filter(port => port <= 65535);

    let lastError = null;
    for (const port of ports) {
        try {
            return await startStaticServer(root, {host: options.host, port});
        } catch (error) {
            lastError = error;
            if (error.code !== "EADDRINUSE") throw error;
        }
    }

    throw lastError;
}

function normalizePort(value) {
    const port = Number.parseInt(value, 10);
    if (Number.isNaN(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid SPA dev port: ${value}`);
    }
    return port;
}

function displayHost(host) {
    if (host === "0.0.0.0" || host === "::") return "127.0.0.1";
    return host.includes(":") ? `[${host}]` : host;
}

function waitForShutdown() {
    return new Promise(resolve => {
        process.once("SIGINT", resolve);
        process.once("SIGTERM", resolve);
    });
}
