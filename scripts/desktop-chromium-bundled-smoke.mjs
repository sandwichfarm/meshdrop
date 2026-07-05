import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {buildDesktopChromiumPackage} from "./build-desktop-package.mjs";
import {runDesktopChromiumTransferProof} from "./desktop-chromium-transfer-proof.mjs";
import {startFakeRelay} from "./fake-nostr-relay.mjs";
import {delay, run} from "./spa-smoke-support.mjs";

const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? "/usr/lib/node_modules/playwright/index.mjs";

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meshdrop-desktop-chromium-bundled-"));
    const relay = await startFakeRelay();
    let shell = null;

    try {
        const result = await buildDesktopChromiumPackage({
            version: process.env.MESHDROP_SMOKE_VERSION || "0.0.0-bundled-smoke",
            outDir: tempDir,
            bundleChromium: true,
            env: {
                ...process.env,
                MESH_DROP_BUILD_ID: "desktop-chromium-bundled-smoke"
            }
        });
        assert.equal(result.chromiumEngineBundled, true);

        const unpackDir = path.join(tempDir, "unpacked");
        await fs.mkdir(unpackDir);
        await run("tar", ["-xzf", result.artifactPath, "-C", unpackDir]);

        const root = path.join(unpackDir, result.prefix);
        const bundledChromium = path.join(root, "bin", "chromium", "chrome");
        await fs.access(bundledChromium);
        shell = await startShell(root);
        await runDesktopChromiumTransferProof({
            chromiumExecutablePath: bundledChromium,
            playwrightModulePath,
            relayUrl: relay.url,
            url: shell.url
        });
        console.log("Proof desktop-chromium-bundled-nostr-webrtc: bundled Chromium delivered meshdrop-desktop-chromium-proof.txt");
    }
    finally {
        if (shell) await stopShell(shell);
        await new Promise(resolve => relay.close(resolve));
        await fs.rm(tempDir, {recursive: true, force: true});
    }
}

async function startShell(root) {
    const launcher = path.join(root, "bin", "meshdrop-desktop-chromium.mjs");
    const appDir = path.join(root, "app");
    const child = spawn(process.execPath, [launcher, "--server-only", "--app-dir", appDir], {
        stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
        stdout += chunk;
    });
    child.stderr.on("data", chunk => {
        stderr += chunk;
    });
    const exited = new Promise(resolve => child.on("exit", resolve));

    for (let attempt = 0; attempt < 80; attempt += 1) {
        const line = stdout.split(/\r?\n/).find(value => value.trim().startsWith("{"));
        if (line) return {child, exited, stderr: () => stderr, ...JSON.parse(line)};
        if (child.exitCode !== null) break;
        await delay(250);
    }

    throw new Error(`Bundled Desktop Chromium shell did not publish a URL:\n${stderr}`);
}

async function stopShell(shell) {
    if (shell.child.exitCode !== null) return;
    shell.child.kill("SIGTERM");
    await Promise.race([shell.exited, delay(2000)]);
    if (shell.child.exitCode === null) shell.child.kill("SIGKILL");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
