#!/usr/bin/env node
import {spawn} from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const appDir = path.resolve(args.appDir || path.join(rootDir, "app"));
    const root = path.resolve(appDir, "..");
    const appIndexExists = await exists(path.join(appDir, "index.html"));

    if (args.printConfig) {
        console.log(JSON.stringify({
            target: "desktop",
            shell: "chromium",
            appDir,
            appIndexExists,
            chromium: findChromium()
        }));
        return;
    }

    if (!appIndexExists) {
        console.error(`MeshDrop app assets not found in ${appDir}`);
        process.exitCode = 66;
        return;
    }

    const server = await startServer(root);
    const url = `http://127.0.0.1:${server.port}/app/`;

    if (args.serverOnly) {
        console.log(JSON.stringify({url, port: server.port}));
        await waitForExit();
        await closeServer(server);
        return;
    }

    if (!findChromium()) {
        await closeServer(server);
        console.error("No Chromium-compatible browser found in a supported system path.");
        process.exitCode = 69;
        return;
    }

    const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-chromium-"));
    const child = spawnChromium(url, profileDir);

    process.on("SIGTERM", () => child.kill("SIGTERM"));
    process.on("SIGINT", () => child.kill("SIGINT"));
    const code = await new Promise(resolve => child.on("exit", resolve));

    await closeServer(server);
    await fs.rm(profileDir, {recursive: true, force: true});
    process.exitCode = code || 0;
}

function parseArgs(argv) {
    const args = {
        appDir: "",
        printConfig: false,
        serverOnly: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === "--app-dir" && i + 1 < argv.length) {
            args.appDir = argv[i + 1];
            i += 1;
        }
        else if (argv[i] === "--meshdrop-print-config") {
            args.printConfig = true;
        }
        else if (argv[i] === "--server-only") {
            args.serverOnly = true;
        }
        else {
            throw new Error(`Unknown argument: ${argv[i]}`);
        }
    }

    return args;
}

function findChromium() {
    const candidates = [
        path.join(rootDir, "bin", "chromium", "chrome"),
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable"
    ].filter(Boolean);

    return candidates.find(candidate => existsSync(candidate)) || "";
}

function spawnChromium(url, profileDir) {
    const args = [
        `--app=${url}`,
        `--user-data-dir=${profileDir}`,
        "--no-first-run",
        "--disable-default-apps"
    ];

    const chromium = findChromium();
    if (chromium) return spawn(chromium, args, {stdio: "inherit"});
    throw new Error("No Chromium-compatible browser found in a supported system path.");
}

function existsSync(filePath) {
    try {
        const stat = fsSync.statSync(filePath);
        return stat.isFile() || stat.isSymbolicLink();
    } catch {
        return false;
    }
}

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function startServer(root) {
    const server = http.createServer(async (request, response) => {
        const urlPath = new URL(request.url, "http://127.0.0.1").pathname;
        const requested = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
        let filePath = path.join(root, requested === "/" ? "app/index.html" : requested);

        if (path.relative(root, filePath).startsWith("..")) {
            response.writeHead(403).end();
            return;
        }

        try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
            const body = await fs.readFile(filePath);
            response.writeHead(200, {"content-type": contentType(filePath)});
            response.end(body);
        } catch {
            const body = await fs.readFile(path.join(root, "app", "index.html"));
            response.writeHead(200, {"content-type": "text/html; charset=utf-8"});
            response.end(body);
        }
    });

    return new Promise(resolve => {
        server.listen(0, "127.0.0.1", () => {
            resolve({
                close: callback => server.close(callback),
                port: server.address().port
            });
        });
    });
}

function closeServer(server) {
    return new Promise(resolve => server.close(resolve));
}

function waitForExit() {
    return new Promise(resolve => {
        process.on("SIGTERM", resolve);
        process.on("SIGINT", resolve);
    });
}

function contentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
    if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".mp3")) return "audio/mpeg";
    if (filePath.endsWith(".ogg")) return "audio/ogg";
    return "application/octet-stream";
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
