import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import {pathToFileURL} from "node:url";

export const repoRoot = new URL("..", import.meta.url);

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export async function waitForHttp(url) {
    for (let i = 0; i < 80; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        }
        catch {
            // Retry while the app boots.
        }
        await delay(250);
    }
    throw new Error(`Timed out waiting for ${url}`);
}

export async function waitForTcp(host, port, label) {
    for (let i = 0; i < 80; i++) {
        if (await canConnect(host, port)) return;
        await delay(250);
    }
    throw new Error(`Timed out waiting for ${label} on ${host}:${port}`);
}

function canConnect(host, port) {
    return new Promise(resolve => {
        const socket = net.createConnection({host, port});
        socket.setTimeout(250);
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("timeout", () => {
            socket.destroy();
            resolve(false);
        });
        socket.once("error", () => resolve(false));
    });
}

export function freePort() {
    return new Promise(resolve => {
        const server = net.createServer();
        server.listen(0, "127.0.0.1", () => {
            const {port} = server.address();
            server.close(() => resolve(port));
        });
    });
}

export async function loadPlaywright() {
    if (playwrightModulePath) {
        try {
            await fs.access(playwrightModulePath);
            return import(pathToFileURL(playwrightModulePath).href);
        }
        catch (error) {
            if (process.env.PLAYWRIGHT_MODULE_PATH) {
                throw new Error(`PLAYWRIGHT_MODULE_PATH is not readable: ${playwrightModulePath}\n${error.message}`);
            }
        }
    }
    return import("playwright");
}

export async function launchOptions() {
    const options = {headless: true};
    const executablePath = await resolveChromiumPath();
    if (executablePath) options.executablePath = executablePath;
    return options;
}

async function resolveChromiumPath() {
    if (chromiumPath !== undefined) return chromiumPath;
    try {
        await fs.access("/usr/bin/chromium");
        return "/usr/bin/chromium";
    }
    catch {
        return "";
    }
}

export function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: repoRoot,
            env: {...process.env, ...options.env},
            stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timeout = options.timeoutMs ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
        }, options.timeoutMs) : null;

        if (options.capture) {
            child.stdout.on("data", chunk => stdout += chunk.toString("utf8"));
            child.stderr.on("data", chunk => stderr += chunk.toString("utf8"));
        }

        child.on("error", reject);
        child.on("close", code => {
            if (timeout) clearTimeout(timeout);
            if (timedOut) {
                reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms\n${stderr}`));
                return;
            }
            if (code === 0 || options.allowFailure) {
                resolve(stdout.trim());
            }
            else {
                reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stderr}`));
            }
        });
    });
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
