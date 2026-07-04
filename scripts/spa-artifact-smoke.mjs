import {execFile} from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import {buildSpaArtifact} from "./build-spa-artifact.mjs";

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH || "/usr/lib/node_modules/playwright/index.mjs";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-spa-artifact-"));
    const result = await buildSpaArtifact({
        version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-smoke",
        outDir: tempDir,
        env: {
            ...process.env,
            MESH_DROP_BUILD_ID: "spa-smoke"
        }
    });
    const unpackDir = path.join(tempDir, "unpacked");
    await fs.mkdir(unpackDir);
    await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

    const root = path.join(unpackDir, result.prefix);
    const server = await startStaticServer(root);
    let browser = null;

    try {
        const {chromium} = await import(playwrightModulePath);
        const launchOptions = {headless: true};
        if (chromiumPath) launchOptions.executablePath = chromiumPath;
        browser = await chromium.launch(launchOptions);
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.stack || error.message));
        page.on("console", message => {
            if (message.type() === "error") pageErrors.push(message.text());
        });
        await page.addInitScript(() => {
            globalThis.__meshdropE2E = {
                config: null,
                configLoaded: false
            };
            window.addEventListener("config", event => {
                globalThis.__meshdropE2E.config = event.detail;
                globalThis.__meshdropE2E.configLoaded = true;
            });
        });

        await page.goto(`http://127.0.0.1:${server.port}`, {waitUntil: "domcontentloaded"});
        await page.waitForFunction(() => globalThis.__meshdropE2E?.peersManager);
        await page.waitForFunction(() => globalThis.__meshdropE2E?.configLoaded);

        const state = await page.evaluate(() => ({
            target: globalThis.__meshdropE2E.config.capabilities.runtime.target,
            hasBackend: globalThis.__meshdropE2E.config.capabilities.runtime.hasBackend,
            localHidden: document.getElementById("local-discovery")?.hasAttribute("hidden"),
            fipsHidden: document.getElementById("fips-discovery")?.hasAttribute("hidden"),
            pollenHidden: document.getElementById("pollen-transfer")?.hasAttribute("hidden"),
            serverSettings: globalThis.__meshdropE2E.config.capabilities.serverSettings.supported
        }));

        assert(state.target === "spa", `Expected SPA runtime, got ${state.target}`);
        assert(state.hasBackend === false, "SPA runtime must not claim a backend");
        assert(state.localHidden === true, "Local discovery control must be hidden");
        assert(state.fipsHidden === true, "FIPS discovery control must be hidden");
        assert(state.pollenHidden === true, "Pollen transfer control must be hidden");
        assert(state.serverSettings === false, "Server settings must be unsupported");
        assert(pageErrors.length === 0, `SPA smoke page errors:\n${pageErrors.join("\n")}`);

        console.log(`SPA artifact smoke passed for ${result.artifactPath}`);
    }
    finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

function startStaticServer(root) {
    const server = http.createServer(async (request, response) => {
        const urlPath = new URL(request.url, "http://127.0.0.1").pathname;
        const requested = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
        let filePath = path.join(root, requested === "/" ? "index.html" : requested);

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
            const body = await fs.readFile(path.join(root, "index.html"));
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

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
